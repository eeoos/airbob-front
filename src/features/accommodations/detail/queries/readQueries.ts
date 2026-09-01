import { useQuery } from "@tanstack/react-query";
import {
  createAccommodationDetailQueryOptions,
  createAccommodationAvailabilityQueryOptions,
  createValidCouponsQueryOptions,
  type AccommodationDetailQueryOptions,
  type AccommodationAvailabilityQueryOptions,
  type ValidCouponsQueryOptions,
} from "./readQueryOptions";
import type { AccommodationDetail } from "../model/accommodationDetail";
import type { AccommodationAvailability } from "../model/accommodationAvailability";
import type { AccommodationCouponCollection } from "../model/coupon";
import { accommodationReadQueryKeys } from "./queryKeys";

export type {
  AccommodationDetailQueryOptions,
  AccommodationAvailabilityQueryOptions,
  ValidCouponsQueryOptions,
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

export const useValidCouponsReadQuery = (options: ValidCouponsQueryOptions) =>
  useQuery<
    AccommodationCouponCollection,
    Error,
    AccommodationCouponCollection,
    ReturnType<typeof accommodationReadQueryKeys.validCoupons>
  >(createValidCouponsQueryOptions(options));
