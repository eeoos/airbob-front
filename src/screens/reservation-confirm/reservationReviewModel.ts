import type { BookingTransactionSnapshot } from "../../workflows/booking-payment/transaction/booking";

export interface ReservationReviewDraft {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adultCount: number;
  readonly childCount: number;
  readonly infantCount: number;
  readonly petCount: number;
  readonly couponId: number | null;
}

export const reviewDraftFromSnapshot = (
  snapshot: BookingTransactionSnapshot,
): ReservationReviewDraft => ({
  checkIn: snapshot.checkIn,
  checkOut: snapshot.checkOut,
  adultCount: snapshot.adultCount,
  childCount: snapshot.childCount,
  infantCount: snapshot.infantCount,
  petCount: snapshot.petCount,
  couponId: snapshot.couponId,
});

export const reviewMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

export const reviewDate = (value: string): string => {
  const [year, month, day] = value.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
};

export const reviewGuests = (draft: ReservationReviewDraft): string =>
  [
    `성인 ${draft.adultCount}명`,
    draft.childCount ? `어린이 ${draft.childCount}명` : null,
    draft.infantCount ? `유아 ${draft.infantCount}명` : null,
    draft.petCount ? `반려동물 ${draft.petCount}마리` : null,
  ]
    .filter(Boolean)
    .join(" · ");

export const reviewFailureMessage = (code: string): string => {
  switch (code) {
    case "R002":
      return "선택한 날짜에 예약할 수 없는 밤이 있습니다. 예약 가능 여부를 다시 확인해주세요.";
    case "R018":
      return "요금 확인 시간이 지났습니다. 최신 요금을 다시 확인해주세요.";
    case "R019":
      return "숙박 요금이나 쿠폰 조건이 변경되었습니다. 최신 요금을 확인한 뒤 결제해주세요.";
    case "R025":
      return "다른 예약을 확인하고 있습니다. 잠시 후 다시 시도해주세요.";
    default:
      return "예약 조건을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";
  }
};
