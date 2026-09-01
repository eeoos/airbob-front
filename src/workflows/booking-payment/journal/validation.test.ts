import type {
  BookingPaymentAttempt,
  BookingPaymentCheckout,
  BookingPaymentJournalData,
  BookingPaymentJournalEnvelope,
  BookingPaymentQuote,
  BookingPaymentReady,
  BookingPaymentRelease,
} from "./types";
import {
  BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
  isAllowedBookingPaymentJournalTransition,
  isBookingPaymentJournalData,
  isBookingPaymentJournalEnvelope,
  isBookingPaymentTerminalPhase,
  parseBookingPaymentJournalEnvelope,
  preservesBookingPaymentJournalImmutableGroups,
} from "./validation";

const now = Date.parse("2026-09-01T10:00:00Z");
const flowId = "10000000-0000-4000-8000-000000000001";
const quoteUid = "20000000-0000-4000-8000-000000000002";
const reservationUid = "30000000-0000-4000-8000-000000000003";
const attemptId = "40000000-0000-4000-8000-000000000004";

const quote = (
  overrides: Partial<BookingPaymentQuote> = {},
): BookingPaymentQuote => ({
  quoteUid,
  accommodationId: 7,
  orderName: "Seoul stay",
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  guestCount: 2,
  nightlyPrice: 1_000,
  nights: 2,
  subtotal: 2_000,
  discountAmount: 100,
  amount: 1_900,
  currency: "KRW",
  paymentRequired: true,
  inventoryHeld: false,
  quoteExpiresAt: "2026-09-01T10:05:00Z",
  serverTime: "2026-09-01T10:00:00Z",
  ...overrides,
});

const checkout: BookingPaymentCheckout = {
  method: "POST",
  resource: "/api/v1/reservations",
  body: { quoteUid, requestMessage: null },
  idempotencyKey: "checkout-key-123",
  requestFingerprint: "a".repeat(64),
};

const ready = (
  overrides: Partial<BookingPaymentReady> = {},
): BookingPaymentReady => ({
  reservationUid,
  orderName: "Seoul stay",
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  guestCount: 2,
  subtotal: 2_000,
  discountAmount: 100,
  amount: 1_900,
  currency: "KRW",
  status: "PAYMENT_PENDING",
  paymentRequired: true,
  paymentAllowed: true,
  holdExpiresAt: "2026-09-01T10:15:00Z",
  serverTime: "2026-09-01T10:00:00Z",
  ...overrides,
});

const attempt = (
  overrides: Partial<BookingPaymentAttempt> = {},
): BookingPaymentAttempt => ({
  paymentAttemptId: attemptId,
  orderId: reservationUid,
  amount: 1_900,
  currency: "KRW",
  holdExpiresAt: "2026-09-01T10:15:00Z",
  remainingSeconds: 900,
  serverTime: "2026-09-01T10:00:00Z",
  ...overrides,
});

const release: BookingPaymentRelease = {
  reservationUid,
  status: "EXPIRED",
  releasedNow: true,
  serverTime: "2026-09-01T10:01:00Z",
};

const common = () => ({
  flowId,
  serverIntent: {
    accommodationId: 7,
    checkInDate: "2026-09-10",
    checkOutDate: "2026-09-12",
    guestCount: 2,
    couponId: 11,
  },
  presentationIntent: {
    adultCount: 1,
    childCount: 1,
    infantCount: 1,
    petCount: 0,
  },
  recoveryExpiresAt: now + 300_000,
  quote: quote(),
});

const data = (
  phase: BookingPaymentJournalData["phase"],
): BookingPaymentJournalData => {
  const base = common();
  switch (phase) {
    case "quoted":
      return { phase, ...base };
    case "checkout-prepared":
    case "checkout-submitting":
      return { phase, ...base, checkout };
    case "complimentary-observed": {
      const complimentaryQuote = quote({
        nightlyPrice: 0,
        subtotal: 0,
        discountAmount: 0,
        amount: 0,
        paymentRequired: false,
      });
      return {
        phase,
        ...base,
        quote: complimentaryQuote,
        checkout,
        ready: ready({
          subtotal: 0,
          discountAmount: 0,
          amount: 0,
          paymentRequired: false,
          paymentAllowed: false,
          status: "CONFIRMED",
          holdExpiresAt: null,
        }),
      };
    }
    case "reservation-ready":
    case "attempt-requesting":
      return { phase, ...base, checkout, ready: ready() };
    case "reservation-status-observed":
      return {
        phase,
        ...base,
        checkout,
        ready: ready({
          status: "PAYMENT_PROCESSING",
          paymentAllowed: false,
          holdExpiresAt: null,
        }),
      };
    case "attempt-ready":
    case "callback-received":
    case "confirm-submitting":
      return { phase, ...base, checkout, ready: ready(), attempt: attempt() };
    case "hold-release-requesting":
      return { phase, ...base, checkout, ready: ready() };
    case "hold-released":
      return { phase, ...base, checkout, ready: ready(), release };
  }
};

const envelope = (
  journalData: BookingPaymentJournalData = data("quoted"),
): BookingPaymentJournalEnvelope => ({
  purpose: "booking-payment-journal",
  version: 2,
  privacyClass: "sensitive",
  containsPii: false,
  owner: "subject:member_a",
  createdAt: now,
  hardExpiresAt: now + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
  lease: {
    runtimeLeaseId: "60000000-0000-4000-8000-000000000006",
    sessionEpoch: 4,
  },
  data: journalData,
});

const validatesQuote = (value: unknown): boolean =>
  isBookingPaymentJournalData({ ...data("quoted"), quote: value });

const validatesReady = (value: BookingPaymentReady): boolean =>
  isBookingPaymentJournalData({
    ...data(
      value.status === "PAYMENT_PENDING"
        ? "reservation-ready"
        : "reservation-status-observed",
    ),
    ready: value,
  });

const validatesAttempt = (value: BookingPaymentAttempt): boolean =>
  isBookingPaymentJournalData({ ...data("attempt-ready"), attempt: value });

const paidPhaseData = (
  amount: number,
  currency: string,
  phase: "reservation-ready" | "attempt-requesting",
): BookingPaymentJournalData => {
  const oneNightQuote = quote({
    checkOut: "2026-09-11",
    nightlyPrice: amount,
    nights: 1,
    subtotal: amount,
    discountAmount: 0,
    amount,
    currency,
  });
  const oneNightReady = ready({
    checkOut: "2026-09-11",
    subtotal: amount,
    discountAmount: 0,
    amount,
    currency,
  });
  return {
    ...data(phase),
    phase,
    serverIntent: {
      ...data(phase).serverIntent,
      checkOutDate: "2026-09-11",
    },
    quote: oneNightQuote,
    ready: oneNightReady,
  } as BookingPaymentJournalData;
};

describe("booking-payment journal v2 validation", () => {
  it("accepts all exact accumulated phase shapes without ordinal ordering", () => {
    const phases: readonly BookingPaymentJournalData["phase"][] = [
      "quoted",
      "checkout-prepared",
      "checkout-submitting",
      "complimentary-observed",
      "reservation-ready",
      "reservation-status-observed",
      "attempt-requesting",
      "attempt-ready",
      "callback-received",
      "confirm-submitting",
      "hold-release-requesting",
      "hold-released",
    ];

    phases.forEach((phase) =>
      expect(isBookingPaymentJournalData(data(phase))).toBe(true),
    );
  });

  it("accepts every current Ready status as structurally recoverable", () => {
    const statuses: readonly BookingPaymentReady["status"][] = [
      "PAYMENT_PENDING",
      "PAYMENT_PROCESSING",
      "CONFIRMED",
      "CANCELLATION_PENDING",
      "CANCELLED",
      "CANCELLATION_FAILED",
      "EXPIRED",
    ];

    statuses.forEach((status) => {
      const value =
        status === "PAYMENT_PENDING"
          ? ready()
          : status === "EXPIRED"
            ? ready({
                status,
                paymentAllowed: false,
                holdExpiresAt: "2026-09-01T10:00:00Z",
              })
            : ready({ status, paymentAllowed: false, holdExpiresAt: null });
      expect({ status, valid: validatesReady(value) }).toEqual({
        status,
        valid: true,
      });
    });
  });

  it("separates complimentary, pending and replay-current Ready branches", () => {
    expect(isBookingPaymentJournalData(data("complimentary-observed"))).toBe(
      true,
    );
    expect(isBookingPaymentJournalData(data("reservation-ready"))).toBe(true);
    expect(
      isBookingPaymentJournalData(data("reservation-status-observed")),
    ).toBe(true);

    expect(
      isBookingPaymentJournalData({
        ...data("reservation-ready"),
        ready: ready({
          status: "CONFIRMED",
          paymentAllowed: false,
          holdExpiresAt: null,
        }),
      }),
    ).toBe(false);
    expect(
      isBookingPaymentJournalData({
        ...data("reservation-status-observed"),
        ready: ready(),
      }),
    ).toBe(false);
  });

  it("keeps unsupported paid Ready inspectable but ineligible for an attempt", () => {
    expect(
      isBookingPaymentJournalData(
        paidPhaseData(99, "KRW", "reservation-ready"),
      ),
    ).toBe(true);
    expect(
      isBookingPaymentJournalData(
        paidPhaseData(99, "KRW", "attempt-requesting"),
      ),
    ).toBe(false);
    expect(
      isBookingPaymentJournalData(
        paidPhaseData(100, "KRW", "attempt-requesting"),
      ),
    ).toBe(true);
    expect(
      isBookingPaymentJournalData(
        paidPhaseData(2_147_483_647, "KRW", "attempt-requesting"),
      ),
    ).toBe(true);
    expect(
      isBookingPaymentJournalData(
        paidPhaseData(2_147_483_648, "KRW", "attempt-requesting"),
      ),
    ).toBe(false);
    expect(
      isBookingPaymentJournalData(
        paidPhaseData(1_900, "USD", "attempt-requesting"),
      ),
    ).toBe(false);
    expect(
      isBookingPaymentJournalData({
        ...data("checkout-submitting"),
        quote: quote({ discountAmount: 1_901, amount: 99 }),
      }),
    ).toBe(false);
  });

  it("accepts safe Java Long recovery values and rejects unsafe money", () => {
    expect(
      isBookingPaymentJournalData(
        paidPhaseData(Number.MAX_SAFE_INTEGER, "KRW", "reservation-ready"),
      ),
    ).toBe(true);
    expect(
      isBookingPaymentJournalData(
        paidPhaseData(Number.MAX_SAFE_INTEGER + 1, "KRW", "reservation-ready"),
      ),
    ).toBe(false);
  });

  it("accepts a replay attempt with zero remaining seconds", () => {
    expect(
      validatesAttempt(
        attempt({
          remainingSeconds: 0,
          serverTime: "2026-09-01T10:14:59.500000001Z",
        }),
      ),
    ).toBe(true);
    expect(
      validatesAttempt(
        attempt({
          remainingSeconds: 1,
          serverTime: "2026-09-01T10:14:59.500000001Z",
        }),
      ),
    ).toBe(false);
    expect(
      validatesAttempt(
        attempt({
          remainingSeconds: 0,
          serverTime: "2026-09-01T10:15:00Z",
        }),
      ),
    ).toBe(false);
  });

  it("requires strict UUID, calendar date, UTC Instant and exact money identities", () => {
    expect(validatesQuote(quote())).toBe(true);
    expect(validatesQuote(quote({ quoteUid: "not-a-uuid" }))).toBe(false);
    expect(validatesQuote(quote({ checkIn: "2026-02-30" }))).toBe(false);
    expect(
      validatesQuote(quote({ serverTime: "2026-09-01T19:00:00+09:00" })),
    ).toBe(false);
    expect(validatesQuote(quote({ subtotal: 2_001 }))).toBe(false);
    expect(validatesQuote({ ...quote(), providerMessage: "secret" })).toBe(
      false,
    );
  });

  it("rejects customer/provider/paymentKey fields anywhere in the exact envelope", () => {
    expect(
      isBookingPaymentJournalEnvelope({
        ...envelope(),
        paymentKey: "must-not-enter",
      }),
    ).toBe(false);
    expect(
      isBookingPaymentJournalData({
        ...data("attempt-ready"),
        customerEmail: "member@example.com",
      }),
    ).toBe(false);
    expect(
      isBookingPaymentJournalData({
        ...data("reservation-ready"),
        ready: { ...ready(), customerEmail: "member@example.com" },
      }),
    ).toBe(false);
    expect(
      isBookingPaymentJournalData({
        ...data("attempt-ready"),
        attempt: {
          ...attempt(),
          paymentKey: "must-not-enter",
          providerMessage: "declined",
        },
      }),
    ).toBe(false);
    expect(
      isBookingPaymentJournalData({
        ...data("checkout-prepared"),
        checkout: {
          ...checkout,
          body: { ...checkout.body, customerName: "Member" },
        },
      }),
    ).toBe(false);
    expect(
      parseBookingPaymentJournalEnvelope(
        JSON.stringify({ ...envelope(), providerMessage: "declined" }),
      ),
    ).toBeNull();
  });

  it("requires the exact envelope constants, one-hour cap and lease pair", () => {
    expect(isBookingPaymentJournalEnvelope(envelope())).toBe(true);
    expect(
      isBookingPaymentJournalEnvelope({
        ...envelope(),
        hardExpiresAt: now + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS + 1,
      }),
    ).toBe(false);
    expect(
      isBookingPaymentJournalEnvelope({
        ...envelope(),
        lease: { ...envelope().lease, runtimeLeaseId: "same-epoch-not-enough" },
      }),
    ).toBe(false);
  });

  it("uses an explicit branch adjacency table and rejects terminal resurrection", () => {
    expect(
      isAllowedBookingPaymentJournalTransition(
        data("checkout-submitting"),
        data("reservation-ready"),
      ),
    ).toBe(true);
    expect(
      isAllowedBookingPaymentJournalTransition(
        data("reservation-ready"),
        data("hold-release-requesting"),
      ),
    ).toBe(true);
    expect(
      isAllowedBookingPaymentJournalTransition(
        data("checkout-prepared"),
        data("attempt-ready"),
      ),
    ).toBe(false);
    const phases: readonly BookingPaymentJournalData["phase"][] = [
      "quoted",
      "checkout-prepared",
      "checkout-submitting",
      "complimentary-observed",
      "reservation-ready",
      "reservation-status-observed",
      "attempt-requesting",
      "attempt-ready",
      "callback-received",
      "confirm-submitting",
      "hold-release-requesting",
      "hold-released",
    ];
    phases.forEach((phase) =>
      expect(
        isAllowedBookingPaymentJournalTransition(
          data("confirm-submitting"),
          data(phase),
        ),
      ).toBe(false),
    );
    expect(isBookingPaymentTerminalPhase("confirm-submitting")).toBe(false);
    expect(isBookingPaymentTerminalPhase("hold-released")).toBe(true);
  });

  it("allows an attempt to appear only on the attempt-requesting edge", () => {
    const readyOnlyReleaseRequest = data("hold-release-requesting");
    const releaseRequestWithFabricatedAttempt = {
      ...readyOnlyReleaseRequest,
      attempt: attempt(),
    } as BookingPaymentJournalData;
    const releaseWithFabricatedAttempt = {
      ...data("hold-released"),
      attempt: attempt(),
    } as BookingPaymentJournalData;
    const attemptedReleaseRequest = {
      ...data("hold-release-requesting"),
      attempt: attempt(),
    } as BookingPaymentJournalData;

    expect(
      isBookingPaymentJournalData(releaseRequestWithFabricatedAttempt),
    ).toBe(true);
    expect(
      preservesBookingPaymentJournalImmutableGroups(
        data("reservation-ready"),
        releaseRequestWithFabricatedAttempt,
      ),
    ).toBe(false);
    expect(isBookingPaymentJournalData(releaseWithFabricatedAttempt)).toBe(
      true,
    );
    expect(
      preservesBookingPaymentJournalImmutableGroups(
        readyOnlyReleaseRequest,
        releaseWithFabricatedAttempt,
      ),
    ).toBe(false);
    expect(
      preservesBookingPaymentJournalImmutableGroups(
        data("attempt-ready"),
        attemptedReleaseRequest,
      ),
    ).toBe(true);
  });

  it("rejects post-Accepted operation state as journal authority", () => {
    const confirmSubmitting = data("confirm-submitting");
    const operation = {
      operationId: "50000000-0000-4000-8000-000000000005",
      reservationUid,
      orderId: reservationUid,
      paymentAttemptId: attemptId,
      amount: 1_900,
      currency: "KRW",
    };

    [
      "operation-known",
      "succeeded-observed",
      "failed",
      "review-required",
    ].forEach((phase) =>
      expect(
        isBookingPaymentJournalData({
          ...confirmSubmitting,
          phase,
          operation,
        }),
      ).toBe(false),
    );
  });

  it("requires accumulated groups to remain byte-equivalent", () => {
    const previous = data("reservation-ready");
    const next = {
      ...data("attempt-requesting"),
      quote: { ...quote(), orderName: "Changed" },
    };
    expect(preservesBookingPaymentJournalImmutableGroups(previous, next)).toBe(
      false,
    );

    const reorderedQuote = {
      accommodationId: quote().accommodationId,
      quoteUid: quote().quoteUid,
      orderName: quote().orderName,
      checkIn: quote().checkIn,
      checkOut: quote().checkOut,
      guestCount: quote().guestCount,
      nightlyPrice: quote().nightlyPrice,
      nights: quote().nights,
      subtotal: quote().subtotal,
      discountAmount: quote().discountAmount,
      amount: quote().amount,
      currency: quote().currency,
      paymentRequired: quote().paymentRequired,
      inventoryHeld: quote().inventoryHeld,
      quoteExpiresAt: quote().quoteExpiresAt,
      serverTime: quote().serverTime,
    };
    expect(
      preservesBookingPaymentJournalImmutableGroups(previous, {
        ...data("attempt-requesting"),
        quote: reorderedQuote,
      }),
    ).toBe(false);

    const callbackReceived = data("callback-received");
    if (callbackReceived.phase !== "callback-received") {
      throw new Error("Expected callback-received fixture");
    }
    expect(
      preservesBookingPaymentJournalImmutableGroups(data("attempt-ready"), {
        ...callbackReceived,
        attempt: { ...attempt(), paymentAttemptId: flowId },
      }),
    ).toBe(false);
  });
});
