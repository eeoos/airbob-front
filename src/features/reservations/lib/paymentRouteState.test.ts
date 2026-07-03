import {
  parsePaymentRouteState,
  parseTossSuccessRouteState,
} from "./paymentRouteState";

describe("payment route state", () => {
  it("parses complete reservation confirm query params", () => {
    const state = parsePaymentRouteState(
      new URLSearchParams(
        "reservationUid=r-1&orderName=Airbob&amount=120000&customerEmail=a%40b.com&customerName=Jae&checkIn=2026-08-01&checkOut=2026-08-03&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1&couponName=Summer&couponDiscount=10000"
      )
    );

    expect(state).toEqual({
      status: "valid",
      reservationUid: "r-1",
      orderName: "Airbob",
      amount: 120000,
      customerEmail: "a@b.com",
      customerName: "Jae",
      checkIn: new Date("2026-08-01"),
      checkOut: new Date("2026-08-03"),
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 0,
      petOccupancy: 1,
      couponName: "Summer",
      couponDiscount: 10000,
    });
  });

  it("marks payment query invalid when required Toss values are missing", () => {
    const state = parsePaymentRouteState(new URLSearchParams("reservationUid=r-1"));

    expect(state).toEqual({
      status: "invalid",
      reason: "MISSING_PAYMENT_QUERY",
    });
  });

  it("marks payment query invalid when amount is not numeric", () => {
    const state = parsePaymentRouteState(
      new URLSearchParams(
        "reservationUid=r-1&orderName=Airbob&amount=abc&customerEmail=a%40b.com&customerName=Jae"
      )
    );

    expect(state).toEqual({
      status: "invalid",
      reason: "INVALID_PAYMENT_AMOUNT",
    });
  });

  it("drops invalid optional date params instead of returning Invalid Date objects", () => {
    const state = parsePaymentRouteState(
      new URLSearchParams(
        "reservationUid=r-1&orderName=Airbob&amount=120000&customerEmail=a%40b.com&customerName=Jae&checkIn=not-a-date&checkOut=2026-99-99"
      )
    );

    expect(state).toMatchObject({
      status: "valid",
      checkIn: null,
      checkOut: null,
    });
  });
});

describe("toss success route state", () => {
  it("parses complete Toss success query params", () => {
    const state = parseTossSuccessRouteState(
      "r-1",
      new URLSearchParams(
        "paymentKey=payment-key-1&orderId=order-1&amount=120000"
      )
    );

    expect(state).toEqual({
      status: "valid",
      reservationUid: "r-1",
      paymentKey: "payment-key-1",
      orderId: "order-1",
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
});
