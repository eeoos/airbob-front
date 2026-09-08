import type {
  AccommodationCouponCollection,
  AccommodationMemberCouponCollection,
  CouponApiRequestOptions,
} from "../model/coupon";

export interface AccommodationCouponApiPort {
  getCampaigns(
    options?: CouponApiRequestOptions,
  ): Promise<AccommodationCouponCollection>;
  getMyCoupons(
    options?: CouponApiRequestOptions,
  ): Promise<AccommodationMemberCouponCollection>;
  issue(couponId: number, options?: CouponApiRequestOptions): Promise<void>;
}
