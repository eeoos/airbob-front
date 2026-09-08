import type { AccommodationApiRequestOptions } from "./accommodationDetail";

type CouponDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

interface CouponDiscount {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly discountType: CouponDiscountType;
  readonly discountValue: number;
  readonly minPaymentPrice: number | null;
  readonly maxDiscountAmount: number | null;
  readonly usableFrom: string;
  readonly usableUntil: string;
}

export interface AccommodationCouponCampaign extends CouponDiscount {
  readonly kind: "campaign";
  readonly issueStartAt: string;
  readonly issueEndAt: string;
  readonly issuanceStatus: "UPCOMING" | "OPEN" | "SOLD_OUT";
  readonly totalQuantity: number | null;
  readonly issuedQuantity: number;
}

export interface AccommodationMemberCoupon extends CouponDiscount {
  readonly kind: "owned";
  readonly status:
    "UPCOMING" | "AVAILABLE" | "UNAVAILABLE" | "USED" | "EXPIRED";
}

export type AccommodationCoupon =
  AccommodationCouponCampaign | AccommodationMemberCoupon;

export interface AccommodationCouponCollection {
  readonly coupons: readonly AccommodationCouponCampaign[];
}

export interface AccommodationMemberCouponCollection {
  readonly coupons: readonly AccommodationMemberCoupon[];
}

export type CouponApiRequestOptions = AccommodationApiRequestOptions;
