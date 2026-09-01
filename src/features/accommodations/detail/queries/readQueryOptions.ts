import {
  createSessionQueryMeta,
  type SessionQueryScope,
} from "../../../../platform/query/sessionScope";
import { accommodationDetailApi as defaultAccommodationDetailApi } from "../api/accommodationDetailApi";
import { accommodationAvailabilityApi as defaultAccommodationAvailabilityApi } from "../api/accommodationAvailabilityApi";
import { accommodationCouponApi as defaultAccommodationCouponApi } from "../api/couponApi";
import type { AccommodationDetail } from "../model/accommodationDetail";
import type { AccommodationAvailability } from "../model/accommodationAvailability";
import type { AccommodationAvailabilityApiPort } from "../ports/accommodationAvailabilityApiPort";
import type { AccommodationDetailApiPort } from "../ports/accommodationDetailApiPort";
import type { AccommodationCouponApiPort } from "../ports/couponApiPort";
import { accommodationReadQueryKeys } from "./queryKeys";

export interface AccommodationDetailQueryOptions {
  readonly scope: SessionQueryScope;
  readonly accommodationId: number | null;
  readonly enabled?: boolean;
}

export const createAccommodationDetailQueryOptions = (
  { scope, accommodationId, enabled = true }: AccommodationDetailQueryOptions,
  api: AccommodationDetailApiPort = defaultAccommodationDetailApi,
) => ({
  queryKey: accommodationReadQueryKeys.detail(scope, accommodationId),
  queryFn: ({ signal }: { readonly signal: AbortSignal }) => {
    if (accommodationId === null) {
      throw new TypeError(
        "accommodationId is required for an accommodation detail query.",
      );
    }

    return api.getDetail(accommodationId, { signal });
  },
  enabled: enabled && accommodationId !== null,
  select: (resource: AccommodationDetail): AccommodationDetail | null => {
    if (accommodationId === null || resource.id !== accommodationId) {
      return null;
    }

    return scope.subject === null && resource.isInWishlist
      ? { ...resource, isInWishlist: false }
      : resource;
  },
  meta: createSessionQueryMeta(scope),
  retry: false as const,
  throwOnError: false as const,
});

export type AccommodationAvailabilityQueryOptions =
  AccommodationDetailQueryOptions;

export const createAccommodationAvailabilityQueryOptions = (
  {
    scope,
    accommodationId,
    enabled = true,
  }: AccommodationAvailabilityQueryOptions,
  api: AccommodationAvailabilityApiPort = defaultAccommodationAvailabilityApi,
) => ({
  queryKey: accommodationReadQueryKeys.availability(scope, accommodationId),
  queryFn: ({ signal }: { readonly signal: AbortSignal }) => {
    if (accommodationId === null) {
      throw new TypeError(
        "accommodationId is required for an accommodation availability query.",
      );
    }

    return api.getAvailability(accommodationId, { signal });
  },
  enabled: enabled && accommodationId !== null,
  select: (
    resource: AccommodationAvailability,
  ): AccommodationAvailability | null =>
    accommodationId !== null && resource.accommodationId === accommodationId
      ? resource
      : null,
  meta: createSessionQueryMeta(scope),
  retry: false as const,
  throwOnError: false as const,
});

export interface ValidCouponsQueryOptions {
  readonly scope: SessionQueryScope;
  readonly enabled?: boolean;
}

export const createValidCouponsQueryOptions = (
  { scope, enabled = true }: ValidCouponsQueryOptions,
  api: AccommodationCouponApiPort = defaultAccommodationCouponApi,
) => ({
  queryKey: accommodationReadQueryKeys.validCoupons(scope),
  queryFn: ({ signal }: { readonly signal: AbortSignal }) =>
    api.getValidCoupons({ signal }),
  enabled: enabled && scope.subject !== null,
  meta: createSessionQueryMeta(scope),
  retry: false as const,
  throwOnError: false as const,
});
