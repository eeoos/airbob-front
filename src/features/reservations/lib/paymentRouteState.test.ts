import {
  parsePaymentFailReason,
  parseTossSuccessRouteState,
} from "./paymentRouteState";

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

describe("payment fail route state", () => {
  it("parses supported payment failure reasons", () => {
    expect(parsePaymentFailReason("confirm-failed")).toBe("confirm-failed");
    expect(parsePaymentFailReason("invalid-callback")).toBe(
      "invalid-callback",
    );
  });

  it("ignores missing or unsupported payment failure reasons", () => {
    expect(parsePaymentFailReason(null)).toBeUndefined();
    expect(parsePaymentFailReason("declined")).toBeUndefined();
    expect(parsePaymentFailReason("")).toBeUndefined();
  });
});
