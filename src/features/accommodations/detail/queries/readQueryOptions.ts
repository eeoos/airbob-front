import {
  createSessionQueryMeta,
  type SessionQueryScope,
} from "../../../../platform/query/sessionScope";
import { accommodationDetailApi as defaultAccommodationDetailApi } from "../api/accommodationDetailApi";
import { accommodationCouponApi as defaultAccommodationCouponApi } from "../api/couponApi";
import type { AccommodationDetail } from "../model/accommodationDetail";
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
