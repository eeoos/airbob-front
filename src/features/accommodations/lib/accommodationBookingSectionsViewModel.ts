import type { CouponInfo } from "../../../types/coupon";
import {
  calculateCouponDiscount,
  formatCouponDiscount,
} from "../../../utils/codes";

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

const getCouponMetadataLabel = (coupon: CouponInfo): string => {
  const metadata = [formatCouponDiscount(coupon)];

  if (coupon.min_payment_price != null) {
    metadata.push(`${coupon.min_payment_price.toLocaleString()}원 이상`);
  }

  if (coupon.total_quantity != null) {
    const remaining = Math.max(
      coupon.total_quantity - coupon.issued_quantity,
      0,
    );
    metadata.push(`남은 수량 ${remaining.toLocaleString()}장`);
  }

  return metadata.join(" · ");
};

export const toAccommodationBookingCouponViewModel = (
  coupon: CouponInfo,
  { issuingCouponId, selectedCouponId, totalPrice }: BookingCouponViewModelOptions,
): AccommodationBookingCouponViewModel => {
  const discount = calculateCouponDiscount(coupon, totalPrice);
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
  coupons: CouponInfo[],
  options: BookingCouponViewModelOptions,
): AccommodationBookingCouponViewModel[] =>
  coupons.map((coupon) => toAccommodationBookingCouponViewModel(coupon, options));
