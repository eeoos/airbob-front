import type {
  AccommodationCoupon,
  AccommodationCouponCampaign,
  AccommodationMemberCoupon,
} from "../model/coupon";

export const mergeAccommodationCoupons = (
  campaigns: readonly AccommodationCouponCampaign[],
  owned: readonly AccommodationMemberCoupon[],
): readonly AccommodationCoupon[] => {
  const ownedIds = new Set(owned.map((coupon) => coupon.id));
  return [...owned, ...campaigns.filter((coupon) => !ownedIds.has(coupon.id))];
};

export const isAccommodationCouponApplicable = (
  coupon: AccommodationCoupon,
  amount: number,
): coupon is AccommodationMemberCoupon =>
  coupon.kind === "owned" &&
  coupon.status === "AVAILABLE" &&
  calculateAccommodationCouponDiscount(coupon, amount) > 0;

export const calculateAccommodationCouponDiscount = (
  coupon: AccommodationCoupon,
  amount: number,
): number => {
  if (coupon.minPaymentPrice !== null && amount < coupon.minPaymentPrice) {
    return 0;
  }

  const discount =
    coupon.discountType === "PERCENTAGE"
      ? Math.floor((amount * coupon.discountValue) / 100)
      : coupon.discountValue;
  const capped =
    coupon.discountType === "PERCENTAGE" && coupon.maxDiscountAmount !== null
      ? Math.min(discount, coupon.maxDiscountAmount)
      : discount;

  return Math.min(Math.max(capped, 0), Math.max(amount, 0));
};

export const formatAccommodationCouponDiscount = (
  coupon: AccommodationCoupon,
): string =>
  coupon.discountType === "PERCENTAGE"
    ? `${coupon.discountValue}% 할인`
    : `${coupon.discountValue.toLocaleString()}원 할인`;
