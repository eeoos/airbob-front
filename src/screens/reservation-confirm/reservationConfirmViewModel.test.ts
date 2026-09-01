import type { BookingTransactionSnapshot } from "../../workflows/booking-payment/transaction/booking";
import { toReservationConfirmCheckoutView } from "./reservationConfirmViewModel";

const snapshot = (): BookingTransactionSnapshot => ({
  phase: "reservation-ready",
  flowId: "10000000-0000-4000-8000-000000000001",
  accommodationId: 42,
  reservationUid: "20000000-0000-4000-8000-000000000002",
  orderName: "테스트 숙소 예약",
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  adultCount: 2,
  childCount: 1,
  infantCount: 1,
  petCount: 1,
  nightlyPrice: 100_000,
  nights: 2,
  subtotal: 200_000,
  discountAmount: 150_000,
  amount: 50_000,
  currency: "KRW",
  couponDisplayName: "적용된 쿠폰",
  quoteExpiresAt: "2026-09-01T10:10:00Z",
  serverTime: "2026-09-01T10:00:00Z",
  paymentRequired: true,
  reservationStatus: "PAYMENT_PENDING",
  paymentAllowed: true,
  holdExpiresAt: "2026-09-01T10:15:00Z",
  canCheckout: false,
  canPay: true,
  canRetryPayment: false,
  canReleaseHold: true,
});

describe("reservation confirm view model", () => {
  it("uses the persisted server quote for every price and stay field", () => {
    expect(toReservationConfirmCheckoutView(snapshot())).toEqual({
      cancellationDeadlineLabel: "9월 9일",
      coupon: {
        discountAmount: 150_000,
        name: "적용된 쿠폰",
      },
      dateLabel: "2026년 9월 10일~2026년 9월 12일",
      guestLabel: "성인 2명, 어린이 1명, 유아 1명, 반려동물 1마리",
      nights: 2,
      payableAmount: 50_000,
      totalPrice: 200_000,
    });
  });

  it("does not derive a discount from mutable accommodation pricing", () => {
    expect(
      toReservationConfirmCheckoutView({
        ...snapshot(),
        couponDisplayName: null,
        discountAmount: 0,
        amount: 180_000,
      }).coupon,
    ).toBeNull();
  });
});
