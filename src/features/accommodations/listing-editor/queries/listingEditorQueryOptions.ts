import { AppError } from "../../../../platform/http/errors";
import { createSessionQueryMeta } from "../../../../platform/query/sessionScope";
import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";
import { listingEditorApi as defaultListingEditorApi } from "../api/listingEditorApi";
import type { ListingEditorAccommodation } from "../model/listingEditor";
import type { ListingEditorApiPort } from "../ports/listingEditorApiPort";
import { LISTING_EDITOR_RESOURCE_MISMATCH_CODE } from "../ports/listingEditorQueryPort";
import { listingEditorQueryKeys } from "./listingEditorQueryKeys";

interface ListingEditorQueryOptions {
  readonly accommodationId: number;
  readonly scope: AuthenticatedSessionScope;
}

export const cloneListingEditorAccommodation = (
  value: ListingEditorAccommodation,
): ListingEditorAccommodation => ({
  ...value,
  address: value.address ? { ...value.address } : null,
  amenities: value.amenities.map((amenity) => ({ ...amenity })),
  images: value.images.map((image) => ({ ...image })),
  occupancyPolicy: value.occupancyPolicy ? { ...value.occupancyPolicy } : null,
});

export const createListingEditorMismatchError = (
  accommodationId: number,
  receivedId: number,
): AppError =>
  new AppError({
    code: LISTING_EDITOR_RESOURCE_MISMATCH_CODE,
    kind: "invalid-response",
    message: `Listing editor resource ${receivedId} does not match ${accommodationId}.`,
  });

export const createListingEditorQueryOptions = (
  { accommodationId, scope }: ListingEditorQueryOptions,
  api: ListingEditorApiPort = defaultListingEditorApi,
) => ({
  queryKey: listingEditorQueryKeys.detail(scope, accommodationId),
  queryFn: async ({ signal }: { readonly signal: AbortSignal }) => {
    const resource = await api.getHostDetail(accommodationId, { signal });
    if (resource.id !== accommodationId) {
      throw createListingEditorMismatchError(accommodationId, resource.id);
    }
    return cloneListingEditorAccommodation(resource);
  },
  meta: createSessionQueryMeta(scope),
  retry: false as const,
  staleTime: 0,
});
