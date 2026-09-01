import type { ReservationQuote, ReservationQuoteInput } from "../model/booking";
import type { ReservationQuoteWire, ReservationReadyWire } from "./contracts";
import {
  toReservationCheckoutIdempotencyKey,
  toReservationCheckoutWireRequest,
  toReservationQuote,
  toReservationQuoteWireRequest,
  toReservationReady,
} from "./mappers";

const QUOTE_UID = "11111111-1111-4111-8111-111111111111";
const RESERVATION_UID = "22222222-2222-4222-8222-222222222222";

const quoteInput = (): ReservationQuoteInput => ({
  accommodationId: 7,
  checkInDate: "2026-09-10",
  checkOutDate: "2026-09-12",
  guestCount: 3,
  couponId: 31,
});

const quoteWire = (): ReservationQuoteWire => ({
  quote_uid: QUOTE_UID,
  accommodation_id: 7,
  order_name: "합정 테스트 숙소 2박",
  check_in: "2026-09-10",
  check_out: "2026-09-12",
  guest_count: 3,
  nightly_price: 100_000,
  nights: 2,
  subtotal: 200_000,
  discount_amount: 30_000,
  amount: 170_000,
  currency: "KRW",
  payment_required: true,
  inventory_held: false,
  quote_expires_at: "2026-09-01T03:05:00.000000001Z",
  server_time: "2026-09-01T03:00:00Z",
});

const quote = (): ReservationQuote =>
  toReservationQuote(quoteWire(), quoteInput());

const readyWire = (): ReservationReadyWire => ({
  reservation_uid: RESERVATION_UID,
  order_name: "합정 테스트 숙소 2박",
  check_in: "2026-09-10",
  check_out: "2026-09-12",
  guest_count: 3,
  subtotal: 200_000,
  discount_amount: 30_000,
  amount: 170_000,
  currency: "KRW",
  status: "PAYMENT_PENDING",
  payment_required: true,
  payment_allowed: true,
  hold_expires_at: "2026-09-01T03:15:00.000000001Z",
  server_time: "2026-09-01T03:00:01Z",
  customer_email: "guest@example.invalid",
  customer_name: "테스트 게스트",
});

describe("reservation booking mappers", () => {
  it("serializes the exact quote request and omits a null coupon", () => {
    expect(toReservationQuoteWireRequest(quoteInput())).toEqual({
      accommodation_id: 7,
      check_in_date: "2026-09-10",
      check_out_date: "2026-09-12",
      guest_count: 3,
      coupon_id: 31,
    });
    expect(
      toReservationQuoteWireRequest({ ...quoteInput(), couponId: null }),
    ).toEqual({
      accommodation_id: 7,
      check_in_date: "2026-09-10",
      check_out_date: "2026-09-12",
      guest_count: 3,
    });
  });

  it.each([
    ["accommodation", { ...quoteInput(), accommodationId: 0 }],
    ["check-in", { ...quoteInput(), checkInDate: "2026-9-10" }],
    ["check-out", { ...quoteInput(), checkOutDate: "2026-02-30" }],
    [
      "reversed stay",
      {
        ...quoteInput(),
        checkInDate: "2026-09-12",
        checkOutDate: "2026-09-10",
      },
    ],
    ["guest", { ...quoteInput(), guestCount: 0 }],
    ["coupon", { ...quoteInput(), couponId: -1 }],
  ])("rejects an invalid quote request %s", (_name, input) => {
    expect(() => toReservationQuoteWireRequest(input)).toThrow(
      "Reservation booking",
    );
  });

  it("maps a validated quote with exact date, night, money, and expiry identities", () => {
    expect(quote()).toEqual({
      quoteUid: QUOTE_UID,
      accommodationId: 7,
      orderName: "합정 테스트 숙소 2박",
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      guestCount: 3,
      nightlyPrice: 100_000,
      nights: 2,
      subtotal: 200_000,
      discountAmount: 30_000,
      amount: 170_000,
      currency: "KRW",
      paymentRequired: true,
      inventoryHeld: false,
      quoteExpiresAt: "2026-09-01T03:05:00.000000001Z",
      serverTime: "2026-09-01T03:00:00Z",
    });
  });

  it("preserves a backend-valid padded quote order name byte-for-byte", () => {
    expect(
      toReservationQuote(
        { ...quoteWire(), order_name: "  합정 테스트 숙소 2박  " },
        quoteInput(),
      ).orderName,
    ).toBe("  합정 테스트 숙소 2박  ");
  });

  it.each([
    ["quote UUID", { quote_uid: "not-a-uuid" }],
    ["accommodation identity", { accommodation_id: 8 }],
    ["order name", { order_name: " \t " }],
    ["check-in identity", { check_in: "2026-09-09" }],
    ["check-out identity", { check_out: "2026-09-13" }],
    ["guest identity", { guest_count: 2 }],
    ["nightly price", { nightly_price: -1 }],
    ["calendar nights", { nights: 3 }],
    ["nightly subtotal", { subtotal: 199_999 }],
    ["discount", { discount_amount: 200_001 }],
    ["amount identity", { amount: 170_001 }],
    ["currency shape", { currency: "krw" }],
    ["payment flag", { payment_required: false }],
    ["inventory authority", { inventory_held: true }],
    ["expiry instant", { quote_expires_at: "2026-09-01T03:00:00Z" }],
    ["server instant", { server_time: "2026-09-01T03:00:00+09:00" }],
  ])("rejects an invalid quote %s", (_name, patch) => {
    expect(() =>
      toReservationQuote({ ...quoteWire(), ...patch }, quoteInput()),
    ).toThrow("Reservation booking");
  });

  it("serializes only the fixed checkout body and validates its capability", () => {
    expect(
      toReservationCheckoutWireRequest({
        quote: quote(),
        idempotencyKey: "checkout:flow_01",
      }),
    ).toEqual({ quote_uid: QUOTE_UID, request_message: null });
    expect(toReservationCheckoutIdempotencyKey("Checkout.Flow:01_A-B")).toBe(
      "Checkout.Flow:01_A-B",
    );
  });

  it.each(["short", "contains/slash", "contains whitespace", "a".repeat(129)])(
    "rejects invalid idempotency capability %j",
    (key) => {
      expect(() => toReservationCheckoutIdempotencyKey(key)).toThrow(
        "Reservation booking idempotencyKey is invalid.",
      );
    },
  );

  it.each([
    ["PAYMENT_PENDING", true, "2026-09-01T03:15:00Z"],
    ["PAYMENT_PROCESSING", false, null],
    ["CONFIRMED", false, null],
    ["CANCELLATION_PENDING", false, null],
    ["CANCELLED", false, null],
    ["CANCELLATION_FAILED", false, null],
    ["EXPIRED", false, "2026-09-01T03:00:01Z"],
  ] as const)(
    "accepts the %s Ready recovery invariant",
    (status, paymentAllowed, holdExpiresAt) => {
      const raw = {
        ...readyWire(),
        status,
        payment_allowed: paymentAllowed,
        hold_expires_at: holdExpiresAt,
      };

      expect(toReservationReady(raw, quote())).toMatchObject({
        reservationUid: RESERVATION_UID,
        status,
        paymentAllowed,
        holdExpiresAt,
      });
    },
  );

  it("accepts the complimentary Ready identity without card eligibility policy", () => {
    const complimentaryQuote = toReservationQuote(
      {
        ...quoteWire(),
        discount_amount: 200_000,
        amount: 0,
        payment_required: false,
      },
      quoteInput(),
    );

    expect(
      toReservationReady(
        {
          ...readyWire(),
          discount_amount: 200_000,
          amount: 0,
          status: "CONFIRMED",
          payment_required: false,
          payment_allowed: false,
          hold_expires_at: null,
        },
        complimentaryQuote,
      ),
    ).toMatchObject({
      amount: 0,
      status: "CONFIRMED",
      paymentRequired: false,
    });
  });

  it("discards customer identity fields at the mapper boundary", () => {
    const mapped = toReservationReady(
      {
        ...readyWire(),
        customer_email: { raw: "must-not-escape" },
        customer_name: ["must-not-escape"],
      },
      quote(),
    );

    expect(mapped).not.toHaveProperty("customerEmail");
    expect(mapped).not.toHaveProperty("customerName");
    expect(mapped).not.toHaveProperty("requestMessage");
  });

  it("accepts and preserves a renamed Ready order name on exact checkout replay", () => {
    expect(
      toReservationReady(
        { ...readyWire(), order_name: "  체크아웃 중 변경된 숙소명  " },
        quote(),
      ).orderName,
    ).toBe("  체크아웃 중 변경된 숙소명  ");
  });

  it.each([
    ["reservation UUID", { reservation_uid: "not-a-uuid" }],
    ["empty order name", { order_name: " \n " }],
    ["check-in identity", { check_in: "2026-09-09" }],
    ["check-out identity", { check_out: "2026-09-13" }],
    ["guest identity", { guest_count: 2 }],
    ["subtotal identity", { subtotal: 200_001 }],
    ["discount identity", { discount_amount: 29_999 }],
    ["amount identity", { amount: 169_999 }],
    ["currency identity", { currency: "USD" }],
    ["unknown status", { status: "REFUNDED" }],
    ["payment required", { payment_required: false }],
    ["payment allowed type", { payment_allowed: 1 }],
    ["hold instant", { hold_expires_at: "2026-09-01T12:15:00+09:00" }],
    ["server chronology", { server_time: "2026-09-01T02:59:59Z" }],
    ["expired hold", { hold_expires_at: "2026-09-01T03:00:01Z" }],
    [
      "terminal active hold",
      {
        status: "CONFIRMED",
        payment_allowed: false,
        hold_expires_at: "2026-09-01T03:15:00Z",
      },
    ],
  ])("rejects an invalid Ready %s", (_name, patch) => {
    expect(() =>
      toReservationReady({ ...readyWire(), ...patch }, quote()),
    ).toThrow("Reservation booking");
  });
});
