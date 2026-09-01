import type { ApiDataRequest } from "../../../../platform/http/request";
import type { ReservationQuote } from "../model/booking";
import type { ReservationQuoteWire, ReservationReadyWire } from "./contracts";
import { createReservationBookingApi } from "./reservationBookingApi";

const QUOTE_UID = "11111111-1111-4111-8111-111111111111";
const RESERVATION_UID = "22222222-2222-4222-8222-222222222222";

const quoteWire: ReservationQuoteWire = {
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
  quote_expires_at: "2026-09-01T03:05:00Z",
  server_time: "2026-09-01T03:00:00Z",
};

const readyWire: ReservationReadyWire = {
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
  hold_expires_at: "2026-09-01T03:15:00Z",
  server_time: "2026-09-01T03:00:01Z",
  customer_email: "guest@example.invalid",
  customer_name: "테스트 게스트",
};

const validQuote = (): ReservationQuote => ({
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
  quoteExpiresAt: "2026-09-01T03:05:00Z",
  serverTime: "2026-09-01T03:00:00Z",
});

describe("reservation booking API adapter", () => {
  it("posts the exact quote contract and forwards cancellation", async () => {
    const request = vi.fn().mockResolvedValue(quoteWire);
    const api = createReservationBookingApi(
      request as <T>(input: ApiDataRequest) => Promise<NonNullable<T>>,
    );
    const signal = new AbortController().signal;

    await expect(
      api.createQuote(
        {
          accommodationId: 7,
          checkInDate: "2026-09-10",
          checkOutDate: "2026-09-12",
          guestCount: 3,
          couponId: 31,
        },
        { signal },
      ),
    ).resolves.toMatchObject({ quoteUid: QUOTE_UID, amount: 170_000 });

    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/reservation-quotes",
      body: {
        accommodation_id: 7,
        check_in_date: "2026-09-10",
        check_out_date: "2026-09-12",
        guest_count: 3,
        coupon_id: 31,
      },
      signal,
    });
  });

  it("omits coupon_id rather than serializing a null coupon", async () => {
    const request = vi.fn().mockResolvedValue(quoteWire);
    const api = createReservationBookingApi(
      request as <T>(input: ApiDataRequest) => Promise<NonNullable<T>>,
    );

    await api.createQuote({
      accommodationId: 7,
      checkInDate: "2026-09-10",
      checkOutDate: "2026-09-12",
      guestCount: 3,
      couponId: null,
    });

    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/reservation-quotes",
      body: {
        accommodation_id: 7,
        check_in_date: "2026-09-10",
        check_out_date: "2026-09-12",
        guest_count: 3,
      },
      signal: undefined,
    });
  });

  it("posts the exact idempotent checkout contract and binds Ready to its quote", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(quoteWire)
      .mockResolvedValueOnce(readyWire);
    const api = createReservationBookingApi(
      request as <T>(input: ApiDataRequest) => Promise<NonNullable<T>>,
    );
    const quote = await api.createQuote({
      accommodationId: 7,
      checkInDate: "2026-09-10",
      checkOutDate: "2026-09-12",
      guestCount: 3,
      couponId: 31,
    });
    const signal = new AbortController().signal;

    await expect(
      api.checkout({ quote, idempotencyKey: "checkout:flow_01" }, { signal }),
    ).resolves.toEqual({
      reservationUid: RESERVATION_UID,
      orderName: "합정 테스트 숙소 2박",
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      guestCount: 3,
      subtotal: 200_000,
      discountAmount: 30_000,
      amount: 170_000,
      currency: "KRW",
      status: "PAYMENT_PENDING",
      paymentRequired: true,
      paymentAllowed: true,
      holdExpiresAt: "2026-09-01T03:15:00Z",
      serverTime: "2026-09-01T03:00:01Z",
    });

    expect(request).toHaveBeenNthCalledWith(2, {
      method: "POST",
      path: "/reservations",
      body: { quote_uid: QUOTE_UID, request_message: null },
      idempotencyKey: "checkout:flow_01",
      signal,
    });
  });

  it("rejects an invalid quote identity returned by the transport", async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ ...quoteWire, accommodation_id: 8 });
    const api = createReservationBookingApi(
      request as <T>(input: ApiDataRequest) => Promise<NonNullable<T>>,
    );

    await expect(
      api.createQuote({
        accommodationId: 7,
        checkInDate: "2026-09-10",
        checkOutDate: "2026-09-12",
        guestCount: 3,
        couponId: 31,
      }),
    ).rejects.toThrow("identity");
  });

  it("rejects an invalid Ready identity returned by the transport", async () => {
    const request = vi.fn().mockResolvedValue({
      ...readyWire,
      amount: 170_001,
    });
    const api = createReservationBookingApi(
      request as <T>(input: ApiDataRequest) => Promise<NonNullable<T>>,
    );

    await expect(
      api.checkout({
        quote: validQuote(),
        idempotencyKey: "checkout:flow_01",
      }),
    ).rejects.toThrow("identity");
  });

  it("rejects a malformed idempotency key before transport access", async () => {
    const request = vi.fn();
    const api = createReservationBookingApi(
      request as <T>(input: ApiDataRequest) => Promise<NonNullable<T>>,
    );

    await expect(
      api.checkout({
        quote: validQuote(),
        idempotencyKey: "bad/key",
      }),
    ).rejects.toThrow("idempotencyKey");
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    ["quoteUid", { quoteUid: "not-a-uuid" }],
    ["accommodationId", { accommodationId: 0 }],
    ["orderName", { orderName: " \t " }],
    ["checkIn", { checkIn: "2026-9-10" }],
    ["checkOut", { checkOut: "2026-09-09" }],
    ["guestCount", { guestCount: 0 }],
    ["nightlyPrice", { nightlyPrice: -1 }],
    ["nights", { nights: 3 }],
    ["subtotal", { subtotal: 199_999 }],
    ["discountAmount", { discountAmount: -1 }],
    ["amount", { amount: 170_001 }],
    ["currency", { currency: "krw" }],
    ["paymentRequired", { paymentRequired: false }],
    ["inventoryHeld", { inventoryHeld: true }],
    ["quoteExpiresAt", { quoteExpiresAt: "2026-09-01T03:00:00Z" }],
    ["serverTime", { serverTime: "not-an-instant" }],
    ["extra field", { raw_message: "must-not-cross" }],
  ])(
    "rejects a malformed supplied Quote %s before checkout transport",
    async (_field, patch) => {
      const request = vi.fn();
      const api = createReservationBookingApi(
        request as <T>(input: ApiDataRequest) => Promise<NonNullable<T>>,
      );
      const suppliedQuote = {
        ...validQuote(),
        ...patch,
      } as ReservationQuote;

      await expect(
        api.checkout({
          quote: suppliedQuote,
          idempotencyKey: "checkout:flow_01",
        }),
      ).rejects.toThrow("Reservation booking");
      expect(request).not.toHaveBeenCalled();
    },
  );

  it.each(Object.keys(validQuote()))(
    "rejects a supplied Quote missing %s before checkout transport",
    async (field) => {
      const request = vi.fn();
      const api = createReservationBookingApi(
        request as <T>(input: ApiDataRequest) => Promise<NonNullable<T>>,
      );
      const suppliedQuote = Object.fromEntries(
        Object.entries(validQuote()).filter(([key]) => key !== field),
      ) as unknown as ReservationQuote;

      await expect(
        api.checkout({
          quote: suppliedQuote,
          idempotencyKey: "checkout:flow_01",
        }),
      ).rejects.toThrow("Reservation booking");
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("accepts a renamed padded Ready order name on idempotent replay", async () => {
    const request = vi.fn().mockResolvedValue({
      ...readyWire,
      order_name: "  서버에서 변경된 숙소명  ",
    });
    const api = createReservationBookingApi(
      request as <T>(input: ApiDataRequest) => Promise<NonNullable<T>>,
    );

    await expect(
      api.checkout({
        quote: validQuote(),
        idempotencyKey: "checkout:flow_01",
      }),
    ).resolves.toMatchObject({ orderName: "  서버에서 변경된 숙소명  " });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
