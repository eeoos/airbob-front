import {
  paymentCodec,
  serializePaymentFailRouteQuery,
  serializePaymentSuccessRouteQuery,
} from "./paymentCodec";

describe("paymentCodec", () => {
  it.each([
    ["confirm-failed", "confirm-failed"],
    ["invalid-callback", "invalid-callback"],
    ["declined", undefined],
    [null, undefined],
  ] as const)("parses payment fail reason %s", (value, expected) => {
    expect(paymentCodec.parseFailReason(value)).toBe(expected);
  });

  it("parses and round-trips valid payment query state", () => {
    const state = paymentCodec.parse(
      "amount=120000&orderId=reservation-123&paymentKey=payment-key-1&reason=confirm-failed",
    );

    expect(state).toEqual({
      reason: "confirm-failed",
      paymentKey: "payment-key-1",
      orderId: "reservation-123",
      amount: "120000",
    });
    expect(paymentCodec.parse(paymentCodec.serialize(state))).toEqual(state);
  });

  it("drops unsupported reason and unsafe amount during normalization", () => {
    expect(
      paymentCodec.parse(
        "reason=declined&paymentKey=&orderId=&amount=9007199254740992",
      ),
    ).toEqual({});
  });

  it("canonicalizes independently of insertion order", () => {
    expect(
      paymentCodec.canonicalize(
        "amount=120000&paymentKey=key&orderId=reservation-123&reason=confirm-failed",
      ),
    ).toBe(
      paymentCodec.canonicalize(
        "reason=confirm-failed&orderId=reservation-123&paymentKey=key&amount=120000",
      ),
    );
    expect(
      paymentCodec.canonicalize(
        "amount=120000&paymentKey=key&orderId=reservation-123&reason=confirm-failed",
      ),
    ).toBe(
      "reason=confirm-failed&paymentKey=key&orderId=reservation-123&amount=120000",
    );
  });

  it("preserves Toss success validation outcomes", () => {
    expect(
      paymentCodec.parseSuccess(
        "reservation-123",
        "paymentKey=key&orderId=reservation-123&amount=120000",
      ),
    ).toEqual({
      status: "valid",
      reservationUid: "reservation-123",
      paymentKey: "key",
      orderId: "reservation-123",
      amount: "120000",
    });
    expect(
      paymentCodec.parseSuccess(
        "reservation-123",
        "paymentKey=key&amount=120000",
      ),
    ).toEqual({
      status: "invalid",
      reason: "MISSING_TOSS_SUCCESS_QUERY",
    });
    expect(
      paymentCodec.parseSuccess(
        "reservation-123",
        "paymentKey=key&orderId=other&amount=120000",
      ),
    ).toEqual({ status: "invalid", reason: "MISMATCHED_TOSS_ORDER" });
    expect(
      paymentCodec.parseSuccess(
        "reservation-123",
        "paymentKey=key&orderId=reservation-123&amount=120000x",
      ),
    ).toEqual({
      status: "invalid",
      reason: "INVALID_TOSS_SUCCESS_AMOUNT",
    });
  });

  it("keeps success and fail callback serialization order", () => {
    expect(
      serializePaymentSuccessRouteQuery({
        amount: 120000,
        orderId: "reservation-123",
        paymentKey: "payment/key 1",
      }).toString(),
    ).toBe(
      "paymentKey=payment%2Fkey+1&orderId=reservation-123&amount=120000",
    );
    expect(
      serializePaymentFailRouteQuery({
        amount: 120000,
        orderId: "reservation-123",
        paymentKey: "payment/key 1",
        reason: "confirm-failed",
      }).toString(),
    ).toBe(
      "reason=confirm-failed&paymentKey=payment%2Fkey+1&orderId=reservation-123&amount=120000",
    );
  });
});
