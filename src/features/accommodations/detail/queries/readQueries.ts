import { useQuery } from "@tanstack/react-query";
import {
  createAccommodationDetailQueryOptions,
  createAccommodationAvailabilityQueryOptions,
  createCouponCampaignsQueryOptions,
  createMemberCouponsQueryOptions,
  type AccommodationDetailQueryOptions,
  type AccommodationAvailabilityQueryOptions,
  type CouponQueryOptions,
} from "./readQueryOptions";
import type { AccommodationDetail } from "../model/accommodationDetail";
import type { AccommodationAvailability } from "../model/accommodationAvailability";
import type {
  AccommodationCouponCollection,
  AccommodationMemberCouponCollection,
} from "../model/coupon";
import { accommodationReadQueryKeys } from "./queryKeys";

export type {
  AccommodationDetailQueryOptions,
  AccommodationAvailabilityQueryOptions,
  CouponQueryOptions,
} from "./readQueryOptions";

export const useAccommodationDetailReadQuery = (
  options: AccommodationDetailQueryOptions,
) =>
  useQuery<
    AccommodationDetail,
    Error,
    AccommodationDetail | null,
    ReturnType<typeof accommodationReadQueryKeys.detail>
  >(createAccommodationDetailQueryOptions(options));

export const useAccommodationAvailabilityReadQuery = (
  options: AccommodationAvailabilityQueryOptions,
) =>
  useQuery<
    AccommodationAvailability,
    Error,
    AccommodationAvailability | null,
    ReturnType<typeof accommodationReadQueryKeys.availability>
  >(createAccommodationAvailabilityQueryOptions(options));

export const useCouponCampaignsReadQuery = (options: CouponQueryOptions) =>
  useQuery<
    AccommodationCouponCollection,
    Error,
    AccommodationCouponCollection,
    ReturnType<typeof accommodationReadQueryKeys.couponCampaigns>
  >(createCouponCampaignsQueryOptions(options));

export const useMemberCouponsReadQuery = (options: CouponQueryOptions) =>
  useQuery<
    AccommodationMemberCouponCollection,
    Error,
    AccommodationMemberCouponCollection,
    ReturnType<typeof accommodationReadQueryKeys.memberCoupons>
  >(createMemberCouponsQueryOptions(options));
