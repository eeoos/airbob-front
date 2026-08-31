import type { AccommodationApiRequestOptions } from "./accommodationDetail";

type CouponDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface AccommodationCoupon {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly discountType: CouponDiscountType;
  readonly discountValue: number;
  readonly minPaymentPrice: number | null;
  readonly maxDiscountAmount: number | null;
  readonly startDate: string;
  readonly endDate: string;
  readonly totalQuantity: number | null;
  readonly issuedQuantity: number;
}

export interface AccommodationCouponCollection {
  readonly coupons: readonly AccommodationCoupon[];
}

export type CouponApiRequestOptions = AccommodationApiRequestOptions;
