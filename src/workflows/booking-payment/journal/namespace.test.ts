import {
  BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
  BOOKING_PAYMENT_V2_JOURNAL_KEY,
  BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
  isBookingPaymentV2KnownKey,
  orderBookingPaymentCleanupKeys,
  peekBookingPaymentRecordVersion,
} from "./namespace";

describe("booking-payment v2 namespace", () => {
  it("recognizes only the three exact current slots", () => {
    expect(
      [
        BOOKING_PAYMENT_V2_JOURNAL_KEY,
        BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
        BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
      ].every(isBookingPaymentV2KnownKey),
    ).toBe(true);
    expect(isBookingPaymentV2KnownKey("airbob:booking-payment-v2:future")).toBe(
      false,
    );
    expect(
      isBookingPaymentV2KnownKey("airbob:booking-payment-v20:journal"),
    ).toBe(false);
  });

  it("orders credential before journal and keeps receipt last", () => {
    expect(
      orderBookingPaymentCleanupKeys([
        BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
        "airbob:booking-payment-v2:unknown",
        BOOKING_PAYMENT_V2_JOURNAL_KEY,
        "airbob:booking-payment-v1:checkout",
        BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
      ]),
    ).toEqual([
      BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
      BOOKING_PAYMENT_V2_JOURNAL_KEY,
      "airbob:booking-payment-v2:unknown",
      "airbob:booking-payment-v1:checkout",
      BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
    ]);
  });

  it("peeks only a safe integer version without interpreting payloads", () => {
    expect(peekBookingPaymentRecordVersion('{"version":2,"secret":"x"}')).toBe(
      2,
    );
    expect(peekBookingPaymentRecordVersion('{"version":3}')).toBe(3);
    expect(peekBookingPaymentRecordVersion('{"version":"2"}')).toBeNull();
    expect(peekBookingPaymentRecordVersion("not-json")).toBeNull();
  });
});
