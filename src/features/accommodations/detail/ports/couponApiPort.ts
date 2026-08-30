import type {
  AccommodationCouponCollection,
  CouponApiRequestOptions,
} from "../model/coupon";

export interface AccommodationCouponApiPort {
  getValidCoupons(
    options?: CouponApiRequestOptions,
  ): Promise<AccommodationCouponCollection>;
  issue(couponId: number, options?: CouponApiRequestOptions): Promise<void>;
}
