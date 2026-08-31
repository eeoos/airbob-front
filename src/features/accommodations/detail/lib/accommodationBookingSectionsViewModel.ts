import type { AccommodationCoupon } from "../model/coupon";
import {
  calculateAccommodationCouponDiscount,
  formatAccommodationCouponDiscount,
} from "./accommodationCouponRules";

export interface AccommodationBookingCouponViewModel {
  actionLabel: string;
  discount: number;
  id: number;
  isApplicable: boolean;
  isIssuing: boolean;
  isSelected: boolean;
  metadataLabel: string;
  name: string;
}

interface BookingCouponViewModelOptions {
  issuingCouponId: number | null;
  selectedCouponId: number | null;
  totalPrice: number;
}

const getCouponActionLabel = ({
  isApplicable,
  isIssuing,
  isSelected,
}: {
  isApplicable: boolean;
  isIssuing: boolean;
  isSelected: boolean;
}) => {
  if (isSelected) {
    return "적용 중";
  }
  if (isIssuing) {
    return "발급 중";
  }
  if (isApplicable) {
    return "발급/적용";
  }
  return "조건 미달";
};

const getCouponMetadataLabel = (coupon: AccommodationCoupon): string => {
  const metadata = [formatAccommodationCouponDiscount(coupon)];

  if (coupon.minPaymentPrice !== null) {
    metadata.push(`${coupon.minPaymentPrice.toLocaleString()}원 이상`);
  }

  if (coupon.totalQuantity !== null) {
    const remaining = Math.max(coupon.totalQuantity - coupon.issuedQuantity, 0);
    metadata.push(`남은 수량 ${remaining.toLocaleString()}장`);
  }

  return metadata.join(" · ");
};

export const toAccommodationBookingCouponViewModel = (
  coupon: AccommodationCoupon,
  {
    issuingCouponId,
    selectedCouponId,
    totalPrice,
  }: BookingCouponViewModelOptions,
): AccommodationBookingCouponViewModel => {
  const discount = calculateAccommodationCouponDiscount(coupon, totalPrice);
  const isApplicable = discount > 0;
  const isSelected = selectedCouponId === coupon.id && isApplicable;
  const isIssuing = issuingCouponId === coupon.id;

  return {
    actionLabel: getCouponActionLabel({
      isApplicable,
      isIssuing,
      isSelected,
    }),
    discount,
    id: coupon.id,
    isApplicable,
    isIssuing,
    isSelected,
    metadataLabel: getCouponMetadataLabel(coupon),
    name: coupon.name,
  };
};

export const toAccommodationBookingCouponViewModels = (
  coupons: readonly AccommodationCoupon[],
  options: BookingCouponViewModelOptions,
): AccommodationBookingCouponViewModel[] =>
  coupons.map((coupon) =>
    toAccommodationBookingCouponViewModel(coupon, options),
  );
