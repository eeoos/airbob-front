import type { AccommodationCoupon } from "../model/coupon";
import {
  calculateAccommodationCouponDiscount,
  isAccommodationCouponApplicable,
  formatAccommodationCouponDiscount,
} from "./accommodationCouponRules";

export interface AccommodationBookingCouponViewModel {
  actionLabel: string;
  discount: number;
  id: number;
  isActionEnabled: boolean;
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

const getCouponActionLabel = (
  coupon: AccommodationCoupon,
  isSelected: boolean,
  isIssuing: boolean,
  isApplicable: boolean,
): string => {
  if (isIssuing) return "처리 중";
  if (isSelected) return "적용 중";
  if (coupon.kind === "campaign") {
    return { OPEN: "발급받기", UPCOMING: "발급 예정", SOLD_OUT: "매진" }[
      coupon.issuanceStatus
    ];
  }
  if (coupon.status === "AVAILABLE")
    return isApplicable ? "적용하기" : "금액 조건 미달";
  return {
    UPCOMING: "사용 예정",
    UNAVAILABLE: "사용 불가",
    USED: "사용 완료",
    EXPIRED: "기간 만료",
  }[coupon.status];
};

const getCouponMetadataLabel = (coupon: AccommodationCoupon): string => {
  const metadata = [formatAccommodationCouponDiscount(coupon)];

  if (coupon.minPaymentPrice !== null) {
    metadata.push(`${coupon.minPaymentPrice.toLocaleString()}원 이상`);
  }

  metadata.push(coupon.kind === "owned" ? "보유 쿠폰" : "발급 쿠폰");

  if (coupon.kind === "campaign" && coupon.totalQuantity !== null) {
    const remaining = Math.max(coupon.totalQuantity - coupon.issuedQuantity, 0);
    metadata.push(`남은 수량 ${remaining.toLocaleString()}장`);
  }

  const displayTime = (value: string) => value.slice(0, 16).replace("T", " ");
  if (coupon.kind === "campaign") {
    metadata.push(
      `발급 ${displayTime(coupon.issueStartAt)} ~ ${displayTime(coupon.issueEndAt)}`,
    );
  }
  metadata.push(
    `사용 ${displayTime(coupon.usableFrom)} ~ ${displayTime(coupon.usableUntil)} (한국 시간)`,
  );
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
  const isApplicable = isAccommodationCouponApplicable(coupon, totalPrice);
  const isActionEnabled =
    coupon.kind === "campaign"
      ? coupon.issuanceStatus === "OPEN"
      : isApplicable;
  const isSelected = selectedCouponId === coupon.id && isApplicable;
  const isIssuing = issuingCouponId === coupon.id;

  return {
    actionLabel: getCouponActionLabel(
      coupon,
      isSelected,
      isIssuing,
      isApplicable,
    ),
    discount,
    id: coupon.id,
    isActionEnabled,
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
