import type {
  BookingPaymentAttempt,
  BookingPaymentJournalData,
  BookingPaymentJournalEnvelope,
  BookingPaymentQuote,
  BookingPaymentReady,
} from "./types";
import { BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS } from "./validation";
import type {
  BookingPaymentCallbackCredentialEnvelope,
  BookingPaymentOperationObservation,
  BookingPaymentOperationReceiptEnvelope,
} from "./recoveryRecordsTypes";
import { bookingPaymentRecoveryRecordValidation } from "./recoveryRecordsValidation";

const {
  BOOKING_PAYMENT_CALLBACK_CREDENTIAL_MAX_TTL_MS,
  BOOKING_PAYMENT_CALLBACK_CREDENTIAL_STORAGE_KEY,
  BOOKING_PAYMENT_OPERATION_RECEIPT_HARD_TTL_MS,
  BOOKING_PAYMENT_OPERATION_RECEIPT_STORAGE_KEY,
  classifyBookingPaymentOperationObservationReplacement,
  isBookingPaymentCallbackCredentialEnvelope,
  isBookingPaymentCallbackCredentialJoinedWithJournal,
  isBookingPaymentOperationObservation,
  isBookingPaymentOperationReceiptEnvelope,
  isBookingPaymentOperationReceiptJoinedWithPreAcceptedState,
  parseBookingPaymentCallbackCredentialEnvelope,
  parseBookingPaymentOperationReceiptEnvelope,
} = bookingPaymentRecoveryRecordValidation;

const journalCreatedAt = Date.parse("2026-09-01T09:50:00Z");
const callbackCreatedAt = Date.parse("2026-09-01T10:00:00Z");
const flowId = "10000000-0000-4000-8000-000000000001";
const quoteUid = "20000000-0000-4000-8000-000000000002";
const reservationUid = "30000000-0000-4000-8000-000000000003";
const paymentAttemptId = "40000000-0000-4000-8000-000000000004";
const operationId = "50000000-0000-4000-8000-000000000005";

const quote: BookingPaymentQuote = {
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
  quoteExpiresAt: "2026-09-01T09:55:00Z",
  serverTime: "2026-09-01T09:50:00Z",
};

const ready: BookingPaymentReady = {
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
};

const attempt: BookingPaymentAttempt = {
  paymentAttemptId,
  orderId: reservationUid,
  amount: 1_900,
  currency: "KRW",
  holdExpiresAt: "2026-09-01T10:15:00Z",
  remainingSeconds: 900,
  serverTime: "2026-09-01T10:00:00Z",
};

const journalData = (
  phase:
    | "attempt-ready"
    | "callback-received"
    | "confirm-submitting" = "confirm-submitting",
  recoveryExpiresAt = Date.parse("2026-09-01T10:15:00Z"),
): BookingPaymentJournalData => ({
  phase,
  flowId,
  serverIntent: {
    accommodationId: 7,
    checkInDate: "2026-09-10",
    checkOutDate: "2026-09-12",
    guestCount: 2,
    couponId: null,
  },
  presentationIntent: {
    adultCount: 2,
    childCount: 0,
    infantCount: 0,
    petCount: 0,
  },
  recoveryExpiresAt,
  quote,
  checkout: {
    method: "POST",
    resource: "/api/v1/reservations",
    body: { quoteUid, requestMessage: null },
    idempotencyKey: "checkout-key-123",
    requestFingerprint: "a".repeat(64),
  },
  ready,
  attempt,
});

const journal = (
  phase:
    | "attempt-ready"
    | "callback-received"
    | "confirm-submitting" = "confirm-submitting",
  recoveryExpiresAt = Date.parse("2026-09-01T10:15:00Z"),
): BookingPaymentJournalEnvelope => ({
  purpose: "booking-payment-journal",
  version: 2,
  privacyClass: "sensitive",
  containsPii: false,
  owner: "subject:member_a",
  createdAt: journalCreatedAt,
  hardExpiresAt: journalCreatedAt + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
  lease: {
    runtimeLeaseId: "60000000-0000-4000-8000-000000000006",
    sessionEpoch: 4,
  },
  data: journalData(phase, recoveryExpiresAt),
});

const credential = (
  overrides: Partial<BookingPaymentCallbackCredentialEnvelope> = {},
): BookingPaymentCallbackCredentialEnvelope => ({
  purpose: "booking-payment-callback-credential",
  version: 2,
  privacyClass: "sensitive",
  containsPii: false,
  owner: "subject:member_a",
  createdAt: callbackCreatedAt,
  hardExpiresAt:
    callbackCreatedAt + BOOKING_PAYMENT_CALLBACK_CREDENTIAL_MAX_TTL_MS,
  data: {
    flowId,
    reservationUid,
    orderId: reservationUid,
    paymentAttemptId,
    paymentKey: "provider-key-kept-byte-for-byte",
    amount: 1_900,
    currency: "KRW",
  },
  ...overrides,
});

const observation = (
  overrides: Partial<BookingPaymentOperationObservation> = {},
): BookingPaymentOperationObservation => ({
  status: "PENDING",
  updatedAt: "2026-09-01T10:01:00.123456789Z",
  nextAction: "POLL",
  retryAfterSeconds: 2,
  userFailureCode: null,
  serverTime: "2026-09-01T10:01:01.123456789Z",
  ...overrides,
});

const receipt = (
  overrides: Partial<BookingPaymentOperationReceiptEnvelope> = {},
): BookingPaymentOperationReceiptEnvelope => {
  const createdAt = overrides.createdAt ?? Date.parse("2026-09-01T10:01:00Z");
  return {
    purpose: "booking-payment-operation-receipt",
    version: 2,
    privacyClass: "personal",
    containsPii: false,
    owner: "subject:member_a",
    createdAt,
    hardExpiresAt:
      overrides.hardExpiresAt ??
      createdAt + BOOKING_PAYMENT_OPERATION_RECEIPT_HARD_TTL_MS,
    lease: {
      runtimeLeaseId: "70000000-0000-4000-8000-000000000007",
      sessionEpoch: 5,
    },
    data: {
      flowId,
      operation: {
        operationId,
        reservationUid,
        orderId: reservationUid,
        paymentAttemptId,
        amount: 1_900,
        currency: "KRW",
      },
      observation: null,
    },
    ...overrides,
  };
};

describe("booking payment recovery record validation", () => {
  describe("callback credential", () => {
    it("pins the exact storage key and parses an exact envelope", () => {
      const value = credential();

      expect(BOOKING_PAYMENT_CALLBACK_CREDENTIAL_STORAGE_KEY).toBe(
        "airbob:booking-payment-v2:callback-credential",
      );
      expect(isBookingPaymentCallbackCredentialEnvelope(value)).toBe(true);
      expect(
        parseBookingPaymentCallbackCredentialEnvelope(JSON.stringify(value)),
      ).toEqual(value);
      expect(parseBookingPaymentCallbackCredentialEnvelope("{")).toBeNull();
    });

    it("keeps a nonblank payment key unmodified through parsing", () => {
      const paymentKey = `  ${"k".repeat(196)}  `;
      const value = credential({ data: { ...credential().data, paymentKey } });

      const parsed = parseBookingPaymentCallbackCredentialEnvelope(
        JSON.stringify(value),
      );

      expect(parsed?.data.paymentKey).toBe(paymentKey);
      expect(parsed?.data.paymentKey).toHaveLength(200);
    });

    it("accepts 200 UTF-16 code units and rejects 201 or blank keys", () => {
      expect(
        isBookingPaymentCallbackCredentialEnvelope(
          credential({
            data: { ...credential().data, paymentKey: "k".repeat(200) },
          }),
        ),
      ).toBe(true);
      expect(
        isBookingPaymentCallbackCredentialEnvelope(
          credential({
            data: { ...credential().data, paymentKey: "k".repeat(201) },
          }),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentCallbackCredentialEnvelope(
          credential({ data: { ...credential().data, paymentKey: " \t " } }),
        ),
      ).toBe(false);
    });

    it("counts surrogate pairs as two UTF-16 code units", () => {
      expect(
        isBookingPaymentCallbackCredentialEnvelope(
          credential({
            data: { ...credential().data, paymentKey: "🧾".repeat(100) },
          }),
        ),
      ).toBe(true);
      expect(
        isBookingPaymentCallbackCredentialEnvelope(
          credential({
            data: { ...credential().data, paymentKey: `🧾${"k".repeat(199)}` },
          }),
        ),
      ).toBe(false);
    });

    it("enforces a positive, non-sliding maximum nine-minute TTL", () => {
      expect(isBookingPaymentCallbackCredentialEnvelope(credential())).toBe(
        true,
      );
      expect(
        isBookingPaymentCallbackCredentialEnvelope(
          credential({ hardExpiresAt: callbackCreatedAt + 1 }),
        ),
      ).toBe(true);
      expect(
        isBookingPaymentCallbackCredentialEnvelope(
          credential({ hardExpiresAt: callbackCreatedAt }),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentCallbackCredentialEnvelope(
          credential({
            hardExpiresAt:
              callbackCreatedAt +
              BOOKING_PAYMENT_CALLBACK_CREDENTIAL_MAX_TTL_MS +
              1,
          }),
        ),
      ).toBe(false);
    });

    it.each([99, 2_147_483_648, 100.5])(
      "rejects unsupported amount %s",
      (amount) => {
        expect(
          isBookingPaymentCallbackCredentialEnvelope(
            credential({ data: { ...credential().data, amount } }),
          ),
        ).toBe(false);
      },
    );

    it("requires exact KRW reservation, order, attempt and flow identities", () => {
      expect(
        isBookingPaymentCallbackCredentialEnvelope(
          credential({
            data: { ...credential().data, orderId: operationId },
          }),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentCallbackCredentialEnvelope(
          credential({
            data: { ...credential().data, currency: "USD" as "KRW" },
          }),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentCallbackCredentialEnvelope(
          credential({
            data: { ...credential().data, flowId: "not-a-uuid" },
          }),
        ),
      ).toBe(false);
    });

    it("rejects extra envelope and nested provider fields", () => {
      expect(
        isBookingPaymentCallbackCredentialEnvelope({
          ...credential(),
          lease: journal().lease,
        }),
      ).toBe(false);
      expect(
        isBookingPaymentCallbackCredentialEnvelope({
          ...credential(),
          data: { ...credential().data, providerMessage: "do not persist" },
        }),
      ).toBe(false);
    });

    it.each([
      "attempt-ready",
      "callback-received",
      "confirm-submitting",
    ] as const)("joins the exact %s journal tuple", (phase) => {
      expect(
        isBookingPaymentCallbackCredentialJoinedWithJournal(
          credential(),
          journal(phase),
        ),
      ).toBe(true);
    });

    it("chooses the earlier journal recovery bound exactly", () => {
      const earlyRecovery = callbackCreatedAt + 4 * 60 * 1000;
      const boundedCredential = credential({ hardExpiresAt: earlyRecovery });

      expect(
        isBookingPaymentCallbackCredentialJoinedWithJournal(
          boundedCredential,
          journal("confirm-submitting", earlyRecovery),
        ),
      ).toBe(true);
      expect(
        isBookingPaymentCallbackCredentialJoinedWithJournal(
          credential(),
          journal("confirm-submitting", earlyRecovery),
        ),
      ).toBe(false);
    });

    it("rejects phase, owner, flow and attempt tuple mismatches", () => {
      const reservationReady = {
        ...journal(),
        data: {
          ...journal().data,
          phase: "reservation-ready",
          attempt: undefined,
        },
      };
      expect(
        isBookingPaymentCallbackCredentialJoinedWithJournal(
          credential(),
          reservationReady,
        ),
      ).toBe(false);
      expect(
        isBookingPaymentCallbackCredentialJoinedWithJournal(
          credential({ owner: "subject:member_b" }),
          journal(),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentCallbackCredentialJoinedWithJournal(
          credential({ data: { ...credential().data, flowId: operationId } }),
          journal(),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentCallbackCredentialJoinedWithJournal(
          credential({
            data: { ...credential().data, paymentAttemptId: operationId },
          }),
          journal(),
        ),
      ).toBe(false);
    });

    it("rejects a callback capture timestamp before its journal", () => {
      const createdAt = journalCreatedAt - 1;
      expect(
        isBookingPaymentCallbackCredentialJoinedWithJournal(
          credential({
            createdAt,
            hardExpiresAt:
              createdAt + BOOKING_PAYMENT_CALLBACK_CREDENTIAL_MAX_TTL_MS,
          }),
          journal(),
        ),
      ).toBe(false);
    });
  });

  describe("operation receipt", () => {
    it("pins the exact storage key and parses an initial null observation", () => {
      const value = receipt();

      expect(BOOKING_PAYMENT_OPERATION_RECEIPT_STORAGE_KEY).toBe(
        "airbob:booking-payment-v2:operation-receipt",
      );
      expect(isBookingPaymentOperationReceiptEnvelope(value)).toBe(true);
      expect(
        parseBookingPaymentOperationReceiptEnvelope(JSON.stringify(value)),
      ).toEqual(value);
      expect(
        parseBookingPaymentOperationReceiptEnvelope("not-json"),
      ).toBeNull();
    });

    it("enforces an exact non-sliding 24-hour TTL", () => {
      const value = receipt();
      const updated = receipt({
        createdAt: value.createdAt,
        hardExpiresAt: value.hardExpiresAt,
        data: { ...value.data, observation: observation() },
      });

      expect(isBookingPaymentOperationReceiptEnvelope(updated)).toBe(true);
      expect(
        isBookingPaymentOperationReceiptEnvelope({
          ...updated,
          hardExpiresAt: updated.hardExpiresAt + 1,
        }),
      ).toBe(false);
    });

    it.each([
      observation(),
      observation({ status: "PROCESSING", retryAfterSeconds: 30 }),
      observation({
        status: "SUCCEEDED",
        nextAction: "NONE",
        retryAfterSeconds: null,
      }),
      observation({
        status: "FAILED",
        nextAction: "START_NEW_CHECKOUT",
        retryAfterSeconds: null,
        userFailureCode: "PAYMENT_DECLINED",
      }),
      observation({
        status: "FAILED",
        nextAction: "NONE",
        retryAfterSeconds: null,
        userFailureCode: "PAYMENT_DECLINED",
      }),
      observation({
        status: "REQUIRES_REVIEW",
        nextAction: "CONTACT_SUPPORT",
        retryAfterSeconds: 12,
        userFailureCode: "PAYMENT_REVIEW_REQUIRED",
      }),
    ])("accepts only an allowlisted observation combination", (value) => {
      expect(isBookingPaymentOperationObservation(value)).toBe(true);
      expect(
        isBookingPaymentOperationReceiptEnvelope(
          receipt({ data: { ...receipt().data, observation: value } }),
        ),
      ).toBe(true);
    });

    it.each([
      observation({ retryAfterSeconds: 1 }),
      observation({ retryAfterSeconds: 31 }),
      observation({ nextAction: "NONE" }),
      observation({ userFailureCode: "PAYMENT_DECLINED" }),
      observation({
        status: "SUCCEEDED",
        nextAction: "NONE",
        retryAfterSeconds: 2,
      }),
      observation({
        status: "FAILED",
        nextAction: "CONTACT_SUPPORT",
        retryAfterSeconds: null,
        userFailureCode: "PAYMENT_DECLINED",
      }),
      observation({
        status: "REQUIRES_REVIEW",
        nextAction: "CONTACT_SUPPORT",
        retryAfterSeconds: null,
        userFailureCode: "PAYMENT_REVIEW_REQUIRED",
      }),
    ])("rejects a non-contract observation combination", (value) => {
      expect(isBookingPaymentOperationObservation(value)).toBe(false);
    });

    it("compares strict UTC instants at nanosecond precision", () => {
      expect(
        isBookingPaymentOperationObservation(
          observation({
            updatedAt: "2026-09-01T10:01:00.123456789Z",
            serverTime: "2026-09-01T10:01:00.123456788Z",
          }),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentOperationObservation(
          observation({ updatedAt: "2026-09-01T10:01:00.1234567890Z" }),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentOperationObservation(
          observation({ updatedAt: "2026-09-01T10:01:00+09:00" }),
        ),
      ).toBe(false);
    });

    it("rejects raw backend, provider and credential fields at every exact boundary", () => {
      expect(
        isBookingPaymentOperationReceiptEnvelope({
          ...receipt(),
          data: { ...receipt().data, status_url: "/api/private/path" },
        }),
      ).toBe(false);
      expect(
        isBookingPaymentOperationReceiptEnvelope({
          ...receipt(),
          data: {
            ...receipt().data,
            operation: { ...receipt().data.operation, paymentKey: "secret" },
          },
        }),
      ).toBe(false);
      expect(
        isBookingPaymentOperationReceiptEnvelope({
          ...receipt(),
          data: {
            ...receipt().data,
            observation: { ...observation(), failure_code: "RAW_CODE" },
          },
        }),
      ).toBe(false);
      expect(
        isBookingPaymentOperationReceiptEnvelope({
          ...receipt(),
          data: {
            ...receipt().data,
            observation: { ...observation(), user_message: "raw text" },
          },
        }),
      ).toBe(false);
    });

    it("requires exact UUID, reservation/order identity, KRW and amount bounds", () => {
      expect(
        isBookingPaymentOperationReceiptEnvelope(
          receipt({
            data: {
              ...receipt().data,
              operation: {
                ...receipt().data.operation,
                operationId: "not-a-uuid",
              },
            },
          }),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentOperationReceiptEnvelope(
          receipt({
            data: {
              ...receipt().data,
              operation: { ...receipt().data.operation, orderId: operationId },
            },
          }),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentOperationReceiptEnvelope(
          receipt({
            data: {
              ...receipt().data,
              operation: { ...receipt().data.operation, amount: 99 },
            },
          }),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentOperationReceiptEnvelope(
          receipt({
            data: {
              ...receipt().data,
              operation: {
                ...receipt().data.operation,
                currency: "USD" as "KRW",
              },
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe("observation replacement", () => {
    it("moves from an initial null observation and keeps null idempotent", () => {
      expect(
        classifyBookingPaymentOperationObservationReplacement(
          null,
          observation(),
        ),
      ).toBe("replace");
      expect(
        classifyBookingPaymentOperationObservationReplacement(null, null),
      ).toBe("unchanged");
      expect(
        classifyBookingPaymentOperationObservationReplacement(
          observation(),
          null,
        ),
      ).toBe("reject");
    });

    it("rejects older observations and keeps exact duplicates unchanged", () => {
      const current = observation();
      expect(
        classifyBookingPaymentOperationObservationReplacement(
          current,
          observation({ updatedAt: "2026-09-01T10:00:59.999999999Z" }),
        ),
      ).toBe("reject");
      expect(
        classifyBookingPaymentOperationObservationReplacement(current, current),
      ).toBe("unchanged");
    });

    it("rejects semantic disagreement at the same updatedAt", () => {
      const current = observation();
      expect(
        classifyBookingPaymentOperationObservationReplacement(
          current,
          observation({ status: "PROCESSING" }),
        ),
      ).toBe("reject");
      expect(
        classifyBookingPaymentOperationObservationReplacement(
          observation({ updatedAt: "2026-09-01T10:01:00Z" }),
          observation({ updatedAt: "2026-09-01T10:01:00.0Z" }),
        ),
      ).toBe("reject");

      const failed = observation({
        status: "FAILED",
        nextAction: "START_NEW_CHECKOUT",
        retryAfterSeconds: null,
        userFailureCode: "PAYMENT_DECLINED",
      });
      expect(
        classifyBookingPaymentOperationObservationReplacement(failed, {
          ...failed,
          nextAction: "NONE",
        }),
      ).toBe("reject");
      expect(
        classifyBookingPaymentOperationObservationReplacement(
          current,
          observation({
            status: "REQUIRES_REVIEW",
            nextAction: "CONTACT_SUPPORT",
            retryAfterSeconds: 2,
            userFailureCode: "PAYMENT_REVIEW_REQUIRED",
          }),
        ),
      ).toBe("reject");
    });

    it("requires exact equality while serverTime is unchanged", () => {
      const current = observation({
        serverTime: "2026-09-01T10:01:02Z",
      });

      expect(
        classifyBookingPaymentOperationObservationReplacement(current, {
          ...current,
          retryAfterSeconds: 3,
        }),
      ).toBe("reject");
      expect(
        classifyBookingPaymentOperationObservationReplacement(current, {
          ...current,
          serverTime: "2026-09-01T10:01:02.0Z",
        }),
      ).toBe("reject");
    });

    it("rejects a regressing serverTime at the same updatedAt", () => {
      expect(
        classifyBookingPaymentOperationObservationReplacement(
          observation(),
          observation({ serverTime: "2026-09-01T10:01:01Z" }),
        ),
      ).toBe("reject");
    });

    it.each([
      {
        status: "PENDING" as const,
        nextAction: "POLL" as const,
        retryAfterSeconds: 3,
        userFailureCode: null,
      },
      {
        status: "PROCESSING" as const,
        nextAction: "POLL" as const,
        retryAfterSeconds: 12,
        userFailureCode: null,
      },
      {
        status: "REQUIRES_REVIEW" as const,
        nextAction: "CONTACT_SUPPORT" as const,
        retryAfterSeconds: 30,
        userFailureCode: "PAYMENT_REVIEW_REQUIRED" as const,
      },
    ])(
      "accepts a recalculated retry for stable $status semantics when serverTime advances",
      (state) => {
        const current = observation(state);
        const nextServerTime = "2026-09-01T10:01:02.123456789Z";
        const next = {
          ...current,
          retryAfterSeconds:
            state.retryAfterSeconds === 30 ? 2 : state.retryAfterSeconds + 1,
          serverTime: nextServerTime,
        };

        expect(
          classifyBookingPaymentOperationObservationReplacement(current, {
            ...current,
            serverTime: nextServerTime,
          }),
        ).toBe("replace");
        expect(
          classifyBookingPaymentOperationObservationReplacement(current, next),
        ).toBe("replace");
      },
    );

    it.each([
      {
        status: "SUCCEEDED" as const,
        nextAction: "NONE" as const,
        retryAfterSeconds: null,
        userFailureCode: null,
      },
      {
        status: "FAILED" as const,
        nextAction: "START_NEW_CHECKOUT" as const,
        retryAfterSeconds: null,
        userFailureCode: "PAYMENT_DECLINED" as const,
      },
      {
        status: "FAILED" as const,
        nextAction: "NONE" as const,
        retryAfterSeconds: null,
        userFailureCode: "PAYMENT_DECLINED" as const,
      },
    ])(
      "ignores a clock-only $status refresh after terminal convergence",
      (state) => {
        const current = observation(state);

        expect(
          classifyBookingPaymentOperationObservationReplacement(current, {
            ...current,
            serverTime: "2026-09-01T10:01:02.123456789Z",
          }),
        ).toBe("unchanged");
      },
    );

    it.each([
      ["NONE", "START_NEW_CHECKOUT"],
      ["START_NEW_CHECKOUT", "NONE"],
    ] as const)(
      "accepts the backend's time-derived FAILED action change from %s to %s",
      (previousAction, nextAction) => {
        const current = observation({
          status: "FAILED",
          nextAction: previousAction,
          retryAfterSeconds: null,
          userFailureCode: "PAYMENT_DECLINED",
        });

        expect(
          classifyBookingPaymentOperationObservationReplacement(current, {
            ...current,
            nextAction,
            serverTime: "2026-09-01T10:01:02.123456789Z",
          }),
        ).toBe("replace");
      },
    );

    it("allows a newer review observation to return to pending", () => {
      const review = observation({
        status: "REQUIRES_REVIEW",
        nextAction: "CONTACT_SUPPORT",
        retryAfterSeconds: 10,
        userFailureCode: "PAYMENT_REVIEW_REQUIRED",
      });
      const pending = observation({
        updatedAt: "2026-09-01T10:01:02Z",
        serverTime: "2026-09-01T10:01:03Z",
      });

      expect(
        classifyBookingPaymentOperationObservationReplacement(review, pending),
      ).toBe("replace");
    });

    it("allows unresolved states to converge to terminal states", () => {
      const succeeded = observation({
        status: "SUCCEEDED",
        updatedAt: "2026-09-01T10:01:02Z",
        nextAction: "NONE",
        retryAfterSeconds: null,
        serverTime: "2026-09-01T10:01:03Z",
      });
      expect(
        classifyBookingPaymentOperationObservationReplacement(
          observation(),
          succeeded,
        ),
      ).toBe("replace");
    });

    it.each(["SUCCEEDED", "FAILED"] as const)(
      "does not transition newer %s terminal observations",
      (status) => {
        const terminal =
          status === "SUCCEEDED"
            ? observation({
                status,
                nextAction: "NONE",
                retryAfterSeconds: null,
              })
            : observation({
                status,
                nextAction: "NONE",
                retryAfterSeconds: null,
                userFailureCode: "PAYMENT_DECLINED",
              });
        const newer = observation({
          updatedAt: "2026-09-01T10:01:02Z",
          serverTime: "2026-09-01T10:01:03Z",
        });

        expect(
          classifyBookingPaymentOperationObservationReplacement(
            terminal,
            newer,
          ),
        ).toBe("reject");
      },
    );
  });

  describe("receipt handoff join", () => {
    it("joins exact confirm-submitting journal, credential and receipt tuples", () => {
      expect(
        isBookingPaymentOperationReceiptJoinedWithPreAcceptedState(
          receipt(),
          journal(),
          credential(),
        ),
      ).toBe(true);
    });

    it("accepts a delayed 202 receipt after credential and journal expiry", () => {
      const priorJournal = journal();
      const delayedCreatedAt = priorJournal.hardExpiresAt + 1;

      expect(delayedCreatedAt).toBeGreaterThan(credential().hardExpiresAt);
      expect(
        isBookingPaymentOperationReceiptJoinedWithPreAcceptedState(
          receipt({ createdAt: delayedCreatedAt }),
          priorJournal,
          credential(),
        ),
      ).toBe(true);
    });

    it("rejects a receipt timestamp before either pre-accepted record", () => {
      expect(
        isBookingPaymentOperationReceiptJoinedWithPreAcceptedState(
          receipt({ createdAt: callbackCreatedAt - 1 }),
          journal(),
          credential(),
        ),
      ).toBe(false);
    });

    it("rejects a non-confirm phase without weakening callback recovery", () => {
      expect(
        isBookingPaymentOperationReceiptJoinedWithPreAcceptedState(
          receipt(),
          journal("callback-received"),
          credential(),
        ),
      ).toBe(false);
    });

    it("rejects an invented Detail observation during the Accepted handoff", () => {
      expect(
        isBookingPaymentOperationReceiptJoinedWithPreAcceptedState(
          receipt({
            data: { ...receipt().data, observation: observation() },
          }),
          journal(),
          credential(),
        ),
      ).toBe(false);
    });

    it("rejects owner, flow and immutable operation tuple mismatches", () => {
      expect(
        isBookingPaymentOperationReceiptJoinedWithPreAcceptedState(
          receipt({ owner: "subject:member_b" }),
          journal(),
          credential(),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentOperationReceiptJoinedWithPreAcceptedState(
          receipt({
            data: { ...receipt().data, flowId: operationId },
          }),
          journal(),
          credential(),
        ),
      ).toBe(false);
      expect(
        isBookingPaymentOperationReceiptJoinedWithPreAcceptedState(
          receipt({
            data: {
              ...receipt().data,
              operation: {
                ...receipt().data.operation,
                paymentAttemptId: operationId,
              },
            },
          }),
          journal(),
          credential(),
        ),
      ).toBe(false);
    });
  });
});
