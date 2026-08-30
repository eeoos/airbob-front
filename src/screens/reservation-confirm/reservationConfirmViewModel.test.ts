import type { CheckoutData } from "../../workflows/booking-payment/checkout";
import { toReservationConfirmCheckoutView } from "./reservationConfirmViewModel";

const checkout = (): CheckoutData => ({
  operationId: "operation-1" as CheckoutData["operationId"],
  accommodationId: 42,
  reservationUid: "reservation-1",
  orderName: "테스트 숙소 예약",
  amount: 50_000,
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  adultOccupancy: 2,
  childOccupancy: 1,
  infantOccupancy: 1,
  petOccupancy: 1,
  couponName: "큰 할인",
  couponDiscount: 150_000,
});

describe("reservation confirm view model", () => {
  it("preserves date, guest, cancellation, and discount display semantics", () => {
    expect(toReservationConfirmCheckoutView(checkout(), 100_000)).toEqual({
      cancellationDeadlineLabel: "9월 9일",
      coupon: {
        discountAmount: 150_000,
        name: "큰 할인",
      },
      dateLabel: "2026년 9월 10일~2026년 9월 12일",
      guestLabel: "성인 2명, 어린이 1명, 유아 1명, 반려동물 1마리",
      nights: 2,
      payableAmount: 50_000,
      totalPrice: 200_000,
    });
  });

  it("uses the server create amount to derive a missing coupon discount", () => {
    expect(
      toReservationConfirmCheckoutView(
        { ...checkout(), couponName: null, couponDiscount: null, amount: 180_000 },
        100_000,
      ).coupon,
    ).toEqual({ discountAmount: 20_000, name: null });
  });
});
