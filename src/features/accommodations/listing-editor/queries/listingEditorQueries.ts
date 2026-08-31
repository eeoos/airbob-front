import type { QueryClient } from "@tanstack/react-query";
import { AppError } from "../../../../platform/http/errors";
import { createSessionQueryMeta } from "../../../../platform/query/sessionScope";
import { listingEditorApi as defaultListingEditorApi } from "../api/listingEditorApi";
import type { ListingEditorAccommodation } from "../model/listingEditor";
import type { ListingEditorApiPort } from "../ports/listingEditorApiPort";
import {
  type ListingEditorQueryProjection,
  type ListingEditorQueryPort,
} from "../ports/listingEditorQueryPort";
import {
  cloneListingEditorAccommodation,
  createListingEditorMismatchError,
  createListingEditorQueryOptions,
} from "./listingEditorQueryOptions";
import { listingEditorQueryKeys } from "./listingEditorQueryKeys";

const createCancellationError = (): AppError =>
  new AppError({
    code: "LISTING_EDITOR_QUERY_CANCELLED",
    kind: "cancelled",
    message: "The listing editor query was cancelled.",
  });

const applyUpdateProjection = (
  accommodation: ListingEditorAccommodation,
  projection: Extract<ListingEditorQueryProjection, { kind: "apply-update" }>,
): ListingEditorAccommodation => {
  const { update } = projection;
  return {
    ...accommodation,
    ...(update.name !== undefined ? { name: update.name } : {}),
    ...(update.description !== undefined
      ? { description: update.description }
      : {}),
    ...(update.basePrice !== undefined ? { basePrice: update.basePrice } : {}),
    ...(update.currency !== undefined ? { currency: update.currency } : {}),
    ...(update.type !== undefined ? { type: update.type } : {}),
    ...(update.checkInTime !== undefined
      ? { checkInTime: update.checkInTime }
      : {}),
    ...(update.checkOutTime !== undefined
      ? { checkOutTime: update.checkOutTime }
      : {}),
    ...(update.address !== undefined
      ? {
          address: {
            postalCode: update.address.postalCode,
            country: update.address.country,
            state: update.address.state ?? null,
            city: update.address.city,
            district: update.address.district ?? null,
            street: update.address.street,
            detail: update.address.detail ?? null,
          },
        }
      : {}),
    ...(update.amenities !== undefined
      ? { amenities: update.amenities.map((amenity) => ({ ...amenity })) }
      : {}),
    ...(update.occupancyPolicy !== undefined
      ? { occupancyPolicy: { ...update.occupancyPolicy } }
      : {}),
  };
};

const applyProjection = (
  accommodation: ListingEditorAccommodation,
  projection: ListingEditorQueryProjection,
): ListingEditorAccommodation => {
  if (projection.kind === "apply-update") {
    return applyUpdateProjection(accommodation, projection);
  }
  if (projection.kind === "replace-images") {
    return {
      ...accommodation,
      images: projection.images.map((image) => ({ ...image })),
    };
  }

  const appendedIds = new Set(projection.images.map((image) => image.id));
  return {
    ...accommodation,
    images: [
      ...accommodation.images.filter((image) => !appendedIds.has(image.id)),
      ...projection.images.map((image) => ({ ...image })),
    ],
  };
};

const settleForConsumer = <T>(
  sharedPromise: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> => {
  if (!signal) return sharedPromise;
  if (signal.aborted) return Promise.reject(createCancellationError());

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(createCancellationError());
    };
    signal.addEventListener("abort", abort, { once: true });
    void sharedPromise.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
};

export const createListingEditorQueryPort = (
  queryClient: QueryClient,
  api: ListingEditorApiPort = defaultListingEditorApi,
): ListingEditorQueryPort => ({
  getHostDetail(accommodationId, { scope, signal }) {
    if (signal?.aborted) return Promise.reject(createCancellationError());
    const sharedPromise = queryClient.fetchQuery(
      createListingEditorQueryOptions({ accommodationId, scope }, api),
    );
    return settleForConsumer(sharedPromise, signal);
  },

  projectHostDetail({ accommodationId, fallback, projection, scope }) {
    if (fallback.id !== accommodationId) {
      throw createListingEditorMismatchError(accommodationId, fallback.id);
    }
    const queryKey = listingEditorQueryKeys.detail(scope, accommodationId);
    queryClient.setQueryDefaults(queryKey, {
      meta: createSessionQueryMeta(scope),
    });
    queryClient.setQueryData<ListingEditorAccommodation>(
      queryKey,
      (current: ListingEditorAccommodation | undefined) => {
        const source = current ?? fallback;
        if (source.id !== accommodationId) {
          throw createListingEditorMismatchError(accommodationId, source.id);
        }
        return cloneListingEditorAccommodation(
          applyProjection(cloneListingEditorAccommodation(source), projection),
        );
      },
    );
  },

  setHostDetail({ accommodation, accommodationId, scope }) {
    if (accommodation.id !== accommodationId) {
      throw createListingEditorMismatchError(accommodationId, accommodation.id);
    }
    const queryKey = listingEditorQueryKeys.detail(scope, accommodationId);
    queryClient.setQueryDefaults(queryKey, {
      meta: createSessionQueryMeta(scope),
    });
    queryClient.setQueryData(
      queryKey,
      cloneListingEditorAccommodation(accommodation),
    );
  },
});
