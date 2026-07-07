import {
  formatCheckoutDateParam,
  getReservationPaymentRequestState,
  parseCheckoutDateParam,
  parseTossSuccessRouteState,
} from "./paymentRouteState";
import type { ReservationCheckoutState } from "./reservationCheckoutState";

const checkoutState: ReservationCheckoutState = {
  adultOccupancy: 2,
  amount: 180000,
  checkIn: "2026-07-10",
  checkOut: "2026-07-12",
  childOccupancy: 1,
  couponDiscount: 10000,
  couponName: "여름 할인",
  customerEmail: "guest@example.com",
  customerName: "홍길동",
  infantOccupancy: 1,
  orderName: "테스트 숙소",
  petOccupancy: 0,
  reservationUid: "reservation-123",
};

describe("checkout route state", () => {
  it("formats checkout dates for route state using local date fields", () => {
    expect(formatCheckoutDateParam(new Date(2026, 6, 10))).toBe("2026-07-10");
  });

  it("parses checkout route dates and rejects impossible dates", () => {
    const parsed = parseCheckoutDateParam("2026-07-10");

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(6);
    expect(parsed?.getDate()).toBe(10);
    expect(parseCheckoutDateParam("2026-02-30")).toBeNull();
    expect(parseCheckoutDateParam(undefined)).toBeNull();
  });

  it("marks missing checkout state as unavailable for payment requests", () => {
    expect(getReservationPaymentRequestState(null)).toEqual({
      status: "missing",
    });
    expect(
      getReservationPaymentRequestState({
        ...checkoutState,
        customerEmail: "",
      }),
    ).toEqual({ status: "missing" });
  });

  it("returns Toss payment request fields from complete checkout state", () => {
    expect(getReservationPaymentRequestState(checkoutState)).toEqual({
      status: "valid",
      reservationUid: "reservation-123",
      orderName: "테스트 숙소",
      amount: 180000,
      customerEmail: "guest@example.com",
      customerName: "홍길동",
    });
  });
});

describe("toss success route state", () => {
  it("parses complete Toss success query params", () => {
    const state = parseTossSuccessRouteState(
      "r-1",
      new URLSearchParams("paymentKey=payment-key-1&orderId=r-1&amount=120000")
    );

    expect(state).toEqual({
      status: "valid",
      reservationUid: "r-1",
      paymentKey: "payment-key-1",
      orderId: "r-1",
      amount: "120000",
    });
  });

  it("marks Toss success query invalid when required values are missing", () => {
    const state = parseTossSuccessRouteState(
      "r-1",
      new URLSearchParams("paymentKey=payment-key-1&amount=120000")
    );

    expect(state).toEqual({
      status: "invalid",
      reason: "MISSING_TOSS_SUCCESS_QUERY",
    });
  });

  it("marks Toss success query invalid when orderId does not match reservationUid", () => {
    const state = parseTossSuccessRouteState(
      "reservation-123",
      new URLSearchParams(
        "paymentKey=payment-key-1&orderId=reservation-456&amount=120000"
      )
    );

    expect(state).toEqual({
      status: "invalid",
      reason: "MISMATCHED_TOSS_ORDER",
    });
  });

  it("marks Toss success query invalid when amount is not a safe integer string", () => {
    const state = parseTossSuccessRouteState(
      "reservation-123",
      new URLSearchParams(
        "paymentKey=payment-key-1&orderId=reservation-123&amount=120000x"
      )
    );

    expect(state).toEqual({
      status: "invalid",
      reason: "INVALID_TOSS_SUCCESS_AMOUNT",
    });
  });
});
