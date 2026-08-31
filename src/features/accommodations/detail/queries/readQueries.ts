import { useQuery } from "@tanstack/react-query";
import {
  createAccommodationDetailQueryOptions,
  createValidCouponsQueryOptions,
  type AccommodationDetailQueryOptions,
  type ValidCouponsQueryOptions,
} from "./readQueryOptions";
import type { AccommodationDetail } from "../model/accommodationDetail";
import type { AccommodationCouponCollection } from "../model/coupon";
import { accommodationReadQueryKeys } from "./queryKeys";

export type {
  AccommodationDetailQueryOptions,
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

export const useValidCouponsReadQuery = (options: ValidCouponsQueryOptions) =>
  useQuery<
    AccommodationCouponCollection,
    Error,
    AccommodationCouponCollection,
    ReturnType<typeof accommodationReadQueryKeys.validCoupons>
  >(createValidCouponsQueryOptions(options));
