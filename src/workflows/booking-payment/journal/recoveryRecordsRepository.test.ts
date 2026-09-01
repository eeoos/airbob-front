import type { SessionStorageDriver } from "../../../platform/storage/sessionStorageDriver";
import type {
  BookingPaymentAttempt,
  BookingPaymentJournalData,
  BookingPaymentJournalEnvelope,
  BookingPaymentQuote,
  BookingPaymentReady,
  BookingPaymentRuntimeLease,
} from "./types";
import {
  BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
  BOOKING_PAYMENT_V2_JOURNAL_KEY,
  BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
} from "./namespace";
import type { BookingPaymentOperationObservation } from "./recoveryRecordsTypes";
import { createBookingPaymentRecoveryRecordsRepository } from "./recoveryRecordsRepository";
import { BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS } from "./validation";

const initialNow = Date.parse("2026-09-01T10:00:00Z");
const owner = "subject:member_a";
const flowId = "10000000-0000-4000-8000-000000000001";
const quoteUid = "20000000-0000-4000-8000-000000000002";
const reservationUid = "30000000-0000-4000-8000-000000000003";
const paymentAttemptId = "40000000-0000-4000-8000-000000000004";
const operationId = "50000000-0000-4000-8000-000000000005";
const oldLease: BookingPaymentRuntimeLease = {
  runtimeLeaseId: "60000000-0000-4000-8000-000000000006",
  sessionEpoch: 4,
};
const lease: BookingPaymentRuntimeLease = {
  runtimeLeaseId: "70000000-0000-4000-8000-000000000007",
  sessionEpoch: 5,
};
const nextLease: BookingPaymentRuntimeLease = {
  runtimeLeaseId: "80000000-0000-4000-8000-000000000008",
  sessionEpoch: 6,
};
const paymentKey = "provider-secret-never-in-safe-results";
const retiredKeys = [
  "airbob:booking-payment-v1:callback",
  "airbob:reservation-checkout:7",
  "airbob:reservation-checkout-index:reservation-7",
  "airbob:payment-confirmed:tuple",
] as const;

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
  quoteExpiresAt: "2026-09-01T10:05:00Z",
  serverTime: "2026-09-01T10:00:00Z",
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
    | "confirm-submitting" = "attempt-ready",
  recoveryExpiresAt = initialNow + 15 * 60_000,
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
    | "confirm-submitting" = "attempt-ready",
  overrides: Partial<BookingPaymentJournalEnvelope> = {},
): BookingPaymentJournalEnvelope => ({
  purpose: "booking-payment-journal",
  version: 2,
  privacyClass: "sensitive",
  containsPii: false,
  owner,
  createdAt: initialNow - 10 * 60_000,
  hardExpiresAt: initialNow - 10 * 60_000 + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
  lease: oldLease,
  data: journalData(phase),
  ...overrides,
});

interface StorageHarnessOptions {
  readonly noOpSetKeys?: ReadonlySet<string>;
  readonly noOpRemoveKeys?: ReadonlySet<string>;
}

const createStorageHarness = (
  entries: Record<string, string> = {},
  options: StorageHarnessOptions = {},
) => {
  const values = new Map(Object.entries(entries));
  const calls: string[] = [];
  const driver: SessionStorageDriver = {
    keys: () => {
      calls.push("keys");
      return { ok: true, value: [...values.keys()] };
    },
    getItem: (key) => {
      calls.push(`get:${key}`);
      return { ok: true, value: values.get(key) ?? null };
    },
    setItem: (key, value) => {
      calls.push(`set:${key}`);
      if (!options.noOpSetKeys?.has(key)) values.set(key, value);
      return { ok: true, value: undefined };
    },
    removeItem: (key) => {
      calls.push(`remove:${key}`);
      if (!options.noOpRemoveKeys?.has(key)) values.delete(key);
      return { ok: true, value: undefined };
    },
  };
  return { values, calls, driver };
};

const claimInput = (
  overrides: Partial<
    Parameters<
      ReturnType<
        typeof createBookingPaymentRecoveryRecordsRepository
      >["claimCallbackCredential"]
    >[0]
  > = {},
) => ({
  owner,
  lease,
  reservationUid,
  orderId: reservationUid,
  amount: 1_900,
  paymentKey,
  firstCapturedAt: initialNow,
  isCurrent: () => true,
  ...overrides,
});

const callbackAuthorityInput = (
  overrides: Partial<
    Parameters<
      ReturnType<
        typeof createBookingPaymentRecoveryRecordsRepository
      >["readCallbackCredentialAuthority"]
    >[0]
  > = {},
) => ({
  owner,
  lease,
  flowId,
  reservationUid,
  orderId: reservationUid,
  paymentAttemptId,
  amount: 1_900,
  currency: "KRW" as const,
  isCurrent: () => true,
  ...overrides,
});

const resumeClaimInput = (
  overrides: Partial<
    Parameters<
      ReturnType<
        typeof createBookingPaymentRecoveryRecordsRepository
      >["claimCallbackCredentialForResume"]
    >[0]
  > = {},
) => ({
  owner,
  lease: nextLease,
  flowId,
  reservationUid,
  isCurrent: () => true,
  ...overrides,
});

const storedCallbackClaimInput = (
  overrides: Partial<
    Parameters<
      ReturnType<
        typeof createBookingPaymentRecoveryRecordsRepository
      >["claimStoredCallbackCredentialByReservation"]
    >[0]
  > = {},
) => ({
  owner,
  lease: nextLease,
  reservationUid,
  isCurrent: () => true,
  ...overrides,
});

const receiptInput = (
  overrides: Partial<
    Parameters<
      ReturnType<
        typeof createBookingPaymentRecoveryRecordsRepository
      >["readReceiptAuthority"]
    >[0]
  > = {},
) => ({
  owner,
  lease,
  flowId,
  operationId,
  reservationUid,
  isCurrent: () => true,
  ...overrides,
});

const acceptedInput = () => ({
  ...callbackAuthorityInput(),
  operationId,
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

const createClaimedHarness = (
  phase: "attempt-ready" | "callback-received" | "confirm-submitting",
  options: StorageHarnessOptions = {},
) => {
  const harness = createStorageHarness(
    { [BOOKING_PAYMENT_V2_JOURNAL_KEY]: JSON.stringify(journal(phase)) },
    options,
  );
  const repository = createBookingPaymentRecoveryRecordsRepository({
    driver: harness.driver,
    now: () => initialNow,
  });
  const claimed = repository.claimCallbackCredential(claimInput());
  expect(claimed.status).toBe("claimed");
  return { ...harness, repository };
};

const createReceiptHarness = () => {
  const harness = createClaimedHarness("confirm-submitting");
  const handedOff = harness.repository.handoffAcceptedReceipt(acceptedInput());
  expect(handedOff.status).toBe("handed-off");
  return harness;
};

const createTerminalReceiptHarness = () => {
  const harness = createReceiptHarness();
  const replaced = harness.repository.replaceReceiptObservation({
    ...receiptInput(),
    observation: observation({
      status: "SUCCEEDED",
      updatedAt: "2026-09-01T10:02:00Z",
      nextAction: "NONE",
      retryAfterSeconds: null,
      serverTime: "2026-09-01T10:02:01Z",
    }),
  });
  expect(replaced.status).toBe("replaced");
  harness.calls.length = 0;
  return harness;
};

describe("booking payment recovery command repository", () => {
  describe("callback credential claim", () => {
    it.each([
      "attempt-ready",
      "callback-received",
      "confirm-submitting",
    ] as const)(
      "derives the secret authority from the exact %s journal without caller flow input",
      (phase) => {
        const { repository, values } = createClaimedHarness(phase);

        const result = repository.readCallbackCredentialAuthority(
          callbackAuthorityInput(),
        );

        expect(result).toMatchObject({
          status: "found",
          authority: {
            flowId,
            paymentAttemptId,
            paymentKey,
            phase,
            lease,
          },
        });
        const stored = JSON.parse(
          values.get(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY) ?? "null",
        ) as { createdAt: number; hardExpiresAt: number; data: unknown };
        expect(stored.createdAt).toBe(initialNow);
        expect(stored.hardExpiresAt).toBe(initialNow + 9 * 60_000);
        expect(stored.data).not.toHaveProperty("providerMessage");
      },
    );

    it("uses the earlier journal recovery deadline", () => {
      const earlyDeadline = initialNow + 60_000;
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: JSON.stringify(
          journal("attempt-ready", {
            data: journalData("attempt-ready", earlyDeadline),
          }),
        ),
      });
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: harness.driver,
        now: () => initialNow,
      });

      expect(repository.claimCallbackCredential(claimInput()).status).toBe(
        "claimed",
      );
      expect(
        JSON.parse(
          harness.values.get(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY) ??
            "null",
        ),
      ).toMatchObject({ hardExpiresAt: earlyDeadline });
    });

    it("keeps an exact duplicate byte-stable and does not slide its TTL", () => {
      const { repository, values, calls } =
        createClaimedHarness("attempt-ready");
      const before = values.get(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY);
      calls.length = 0;

      const result = repository.claimCallbackCredential(claimInput());

      expect(result.status).toBe("unchanged");
      expect(values.get(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY)).toBe(
        before,
      );
      expect(calls).not.toContain(
        `set:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
      );
    });

    it("blocks conflicting, stale, expired and invalid callback claims without exposing the key", () => {
      const { repository, calls } = createClaimedHarness("attempt-ready");
      calls.length = 0;

      const conflict = repository.claimCallbackCredential(
        claimInput({ paymentKey: "different-secret" }),
      );
      const stale = repository.claimCallbackCredential(
        claimInput({ isCurrent: () => false }),
      );
      const future = repository.claimCallbackCredential(
        claimInput({ firstCapturedAt: initialNow + 1 }),
      );

      expect(conflict).toEqual({
        status: "rejected",
        reason: "conflicting-credential",
      });
      expect(stale).toEqual({ status: "stale" });
      expect(future).toEqual({
        status: "rejected",
        reason: "invalid-clock",
      });
      expect(JSON.stringify([conflict, stale, future])).not.toContain(
        "different-secret",
      );
      expect(calls).not.toContain(`set:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`);
    });

    it("treats any receipt or unknown/newer slot as a no-fallback barrier before payload reads", () => {
      for (const extraKey of [
        BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
        "airbob:booking-payment-v2:future-record",
      ]) {
        const harness = createStorageHarness({
          [BOOKING_PAYMENT_V2_JOURNAL_KEY]: JSON.stringify(journal()),
          [extraKey]: JSON.stringify({ version: 99, paymentKey }),
        });
        const repository = createBookingPaymentRecoveryRecordsRepository({
          driver: harness.driver,
          now: () => initialNow,
        });

        const result = repository.claimCallbackCredential(claimInput());

        expect(result).toEqual({
          status: "rejected",
          reason:
            extraKey === BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY
              ? "receipt-present"
              : "opaque-v2-state",
        });
        expect(harness.calls).not.toContain(
          `get:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
        );
      }
    });

    it("detects a success-returning no-op write by raw read-back", () => {
      const harness = createStorageHarness(
        { [BOOKING_PAYMENT_V2_JOURNAL_KEY]: JSON.stringify(journal()) },
        {
          noOpSetKeys: new Set([BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]),
        },
      );
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: harness.driver,
        now: () => initialNow,
      });

      expect(repository.claimCallbackCredential(claimInput())).toEqual({
        status: "rejected",
        reason: "write-not-verified",
      });
    });

    it("returns only a safe storage status when the secret write fails", () => {
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: JSON.stringify(journal()),
      });
      const failingDriver: SessionStorageDriver = {
        ...harness.driver,
        setItem: (key, value) =>
          key === BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY
            ? {
                ok: false,
                error: {
                  kind: "storage-unavailable",
                  operation: "set",
                },
              }
            : harness.driver.setItem(key, value),
      };
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: failingDriver,
        now: () => initialNow,
      });

      const result = repository.claimCallbackCredential(claimInput());

      expect(result).toEqual({
        status: "storage-error",
        error: { kind: "storage-unavailable", operation: "set" },
      });
      expect(JSON.stringify(result)).not.toContain(paymentKey);
    });

    it("requires the exact caller-owned handle and current lease on read", () => {
      const { repository } = createClaimedHarness("callback-received");

      expect(
        repository.readCallbackCredentialAuthority(
          callbackAuthorityInput({ flowId: operationId }),
        ),
      ).toEqual({ status: "rejected", reason: "flow-mismatch" });
      expect(
        repository.readCallbackCredentialAuthority(
          callbackAuthorityInput({ lease: oldLease }),
        ),
      ).toEqual({ status: "rejected", reason: "stale-lease" });
    });

    it("rechecks the receipt barrier after reading the pre-Accepted pair", () => {
      const harness = createClaimedHarness("callback-received");
      let receiptReads = 0;
      const racingDriver: SessionStorageDriver = {
        ...harness.driver,
        getItem: (key) => {
          if (
            key === BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY &&
            ++receiptReads === 1
          ) {
            harness.values.set(key, JSON.stringify({ version: 99 }));
          }
          return harness.driver.getItem(key);
        },
      };
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: racingDriver,
        now: () => initialNow,
      });

      expect(
        repository.readCallbackCredentialAuthority(callbackAuthorityInput()),
      ).toEqual({ status: "rejected", reason: "receipt-present" });
    });
  });

  describe("credential-free pre-Accepted resume", () => {
    it.each([
      "attempt-ready",
      "callback-received",
      "confirm-submitting",
    ] as const)(
      "recovers a candidate-claimed %s callback by exact reservation without exposing its secret",
      (phase) => {
        const harness = createClaimedHarness(phase);
        harness.calls.length = 0;

        const result =
          harness.repository.claimStoredCallbackCredentialByReservation(
            storedCallbackClaimInput(),
          );

        expect(result).toMatchObject({
          status: "claimed",
          authority: {
            owner,
            lease: nextLease,
            phase,
            flowId,
            reservationUid,
            paymentAttemptId,
          },
        });
        expect(harness.calls.at(-1)).toBe(
          `get:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
        );
      },
    );

    it("does not discover a stored callback for another reservation", () => {
      const harness = createClaimedHarness("attempt-ready");

      expect(
        harness.repository.claimStoredCallbackCredentialByReservation(
          storedCallbackClaimInput({ reservationUid: operationId }),
        ),
      ).toEqual({ status: "rejected", reason: "locator-mismatch" });
    });

    it("claims a new lease from only the exact confirm-submitting flow and reservation locator", () => {
      const harness = createClaimedHarness("confirm-submitting");
      harness.calls.length = 0;

      const result =
        harness.repository.claimCallbackCredentialForResume(resumeClaimInput());

      expect(result).toMatchObject({
        status: "claimed",
        authority: {
          owner,
          lease: nextLease,
          phase: "confirm-submitting",
          flowId,
          reservationUid,
          paymentAttemptId,
          paymentKey,
        },
      });
      expect(
        JSON.parse(
          harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY) ?? "null",
        ),
      ).toMatchObject({ lease: nextLease });
      expect(harness.calls.at(-1)).toBe(
        `get:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
      );
    });

    it("rejects non-submitting, forged, and owner-mismatched direct references without discovery", () => {
      const phaseMismatch = createClaimedHarness("callback-received");
      expect(
        phaseMismatch.repository.claimCallbackCredentialForResume(
          resumeClaimInput(),
        ),
      ).toEqual({ status: "rejected", reason: "phase-mismatch" });

      const exact = createClaimedHarness("confirm-submitting");
      expect(
        exact.repository.claimCallbackCredentialForResume(
          resumeClaimInput({ flowId: operationId }),
        ),
      ).toEqual({ status: "rejected", reason: "flow-mismatch" });
      expect(
        exact.repository.claimCallbackCredentialForResume(
          resumeClaimInput({ reservationUid: operationId }),
        ),
      ).toEqual({ status: "rejected", reason: "locator-mismatch" });
      expect(
        exact.repository.claimCallbackCredentialForResume(
          resumeClaimInput({ owner: "subject:member_b" }),
        ),
      ).toEqual({ status: "rejected", reason: "foreign-owner" });
    });

    it("treats the receipt slot as an immediate barrier before lower-authority reads", () => {
      const harness = createClaimedHarness("confirm-submitting");
      harness.values.set(
        BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
        JSON.stringify({ version: 99, paymentKey }),
      );
      harness.calls.length = 0;

      expect(
        harness.repository.claimCallbackCredentialForResume(resumeClaimInput()),
      ).toEqual({ status: "rejected", reason: "receipt-present" });
      expect(harness.calls).not.toContain(
        `get:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
      );
      expect(harness.calls).not.toContain(
        `get:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
      );
    });
  });

  describe("Accepted authority handoff", () => {
    it("writes and verifies a secret-free null-observation receipt before purging the pair", () => {
      const { repository, values, calls } =
        createClaimedHarness("confirm-submitting");
      calls.length = 0;

      const result = repository.handoffAcceptedReceipt(acceptedInput());

      expect(result).toMatchObject({
        status: "handed-off",
        cleanup: "complete",
        authority: {
          flowId,
          operation: { operationId, reservationUid, paymentAttemptId },
          observation: null,
        },
      });
      expect(values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY)).toBe(
        false,
      );
      expect(values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
      expect(
        values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY),
      ).not.toContain(paymentKey);
      expect(
        calls.indexOf(`set:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`),
      ).toBeLessThan(
        calls.indexOf(`remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`),
      );
      expect(
        calls.indexOf(`remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`),
      ).toBeLessThan(calls.indexOf(`remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`));
    });

    it("accepts a delayed 202 after the pre-Accepted TTL without inventing an observation", () => {
      const harness = createClaimedHarness("confirm-submitting");
      const delayedRepository = createBookingPaymentRecoveryRecordsRepository({
        driver: harness.driver,
        now: () => initialNow + 20 * 60_000,
      });

      const result = delayedRepository.handoffAcceptedReceipt(acceptedInput());

      expect(result).toMatchObject({
        status: "handed-off",
        authority: { observation: null },
      });
    });

    it("blocks before writing when any receipt slot already exists", () => {
      const { repository, values, calls } =
        createClaimedHarness("confirm-submitting");
      values.set(
        BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
        JSON.stringify({ version: 99, paymentKey }),
      );
      calls.length = 0;

      expect(repository.handoffAcceptedReceipt(acceptedInput())).toEqual({
        status: "rejected",
        reason: "receipt-present",
      });
      expect(calls).not.toContain(
        `set:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
      );
      expect(values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY)).toBe(true);
    });

    it("never rolls back an ambiguous/no-op receipt write", () => {
      const harness = createClaimedHarness("confirm-submitting");
      const noOpDriver: SessionStorageDriver = {
        ...harness.driver,
        setItem: (key, value) =>
          key === BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY
            ? { ok: true, value: undefined }
            : harness.driver.setItem(key, value),
      };
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: noOpDriver,
        now: () => initialNow,
      });

      expect(repository.handoffAcceptedReceipt(acceptedInput())).toEqual({
        status: "rejected",
        reason: "write-not-verified",
      });
      expect(
        harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY),
      ).toBe(true);
      expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(true);
    });

    it("keeps verified receipt authority when lower-authority purge is not verified", () => {
      const harness = createClaimedHarness("confirm-submitting");
      const noRemoveDriver: SessionStorageDriver = {
        ...harness.driver,
        removeItem: (key) =>
          key === BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY
            ? { ok: true, value: undefined }
            : harness.driver.removeItem(key),
      };
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: noRemoveDriver,
        now: () => initialNow,
      });

      const result = repository.handoffAcceptedReceipt(acceptedInput());

      expect(result).toMatchObject({
        status: "handed-off",
        cleanup: "pending",
      });
      expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );
      expect(JSON.stringify(result)).not.toContain(paymentKey);
    });
  });

  describe("operation receipt authority", () => {
    it("claims a new lease only with the exact flow, operation and reservation handle", () => {
      const { repository, values } = createReceiptHarness();
      const before = JSON.parse(
        values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY) ?? "null",
      ) as { hardExpiresAt: number };

      const mismatch = repository.claimReceiptLease({
        ...receiptInput({ lease: nextLease }),
        operationId: paymentAttemptId,
      });
      const claimed = repository.claimReceiptLease(
        receiptInput({ lease: nextLease }),
      );
      const after = JSON.parse(
        values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY) ?? "null",
      ) as { hardExpiresAt: number };

      expect(mismatch).toEqual({
        status: "rejected",
        reason: "tuple-mismatch",
      });
      expect(claimed).toMatchObject({
        status: "claimed",
        authority: { lease: nextLease },
      });
      expect(after.hardExpiresAt).toBe(before.hardExpiresAt);
    });

    it("opportunistically purges credential before journal on an exact live receipt claim", () => {
      const harness = createReceiptHarness();
      harness.values.set(
        BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
        "opaque-lower-secret",
      );
      harness.values.set(
        BOOKING_PAYMENT_V2_JOURNAL_KEY,
        "opaque-lower-journal",
      );
      harness.calls.length = 0;

      const result = harness.repository.claimReceiptLease(
        receiptInput({ lease: nextLease }),
      );

      expect(result).toMatchObject({
        status: "claimed",
        authority: { lease: nextLease },
      });
      expect(
        harness.calls.indexOf(
          `remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
        ),
      ).toBeLessThan(
        harness.calls.indexOf(`remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`),
      );
      expect(
        harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY),
      ).toBe(false);
      expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
      expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );
    });

    it("keeps polling authority when lower cleanup is still pending", () => {
      const harness = createReceiptHarness();
      harness.values.set(
        BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
        "opaque-lower-secret",
      );
      harness.values.set(
        BOOKING_PAYMENT_V2_JOURNAL_KEY,
        "opaque-lower-journal",
      );
      const noOpDriver: SessionStorageDriver = {
        ...harness.driver,
        removeItem: (key) =>
          key === BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY
            ? { ok: true, value: undefined }
            : harness.driver.removeItem(key),
      };
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: noOpDriver,
        now: () => initialNow,
      });

      const result = repository.claimReceiptLease(receiptInput());

      expect(result).toMatchObject({
        status: "unchanged",
        authority: { operation: { operationId }, observation: null },
      });
      expect(
        harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY),
      ).toBe(true);
      expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(true);
      expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );
    });

    it("verified-cleans an exact current-owner expired receipt last and unblocks a later flow", () => {
      const harness = createReceiptHarness();
      harness.values.set(
        BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
        "expired-lower-secret",
      );
      harness.values.set(BOOKING_PAYMENT_V2_JOURNAL_KEY, "expired-journal");
      harness.values.set(retiredKeys[0], "retired-lower-secret");
      harness.calls.length = 0;
      const expiredRepository = createBookingPaymentRecoveryRecordsRepository({
        driver: harness.driver,
        now: () => initialNow + 25 * 60 * 60_000,
      });

      expect(
        expiredRepository.claimReceiptLease(receiptInput({ lease: nextLease })),
      ).toEqual({ status: "verified-expired" });
      expect(harness.values.size).toBe(0);
      expect(
        harness.calls.filter((call) => call.startsWith("remove:")),
      ).toEqual([
        `remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
        `remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
        `remove:${retiredKeys[0]}`,
        `remove:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
      ]);

      harness.values.set(
        BOOKING_PAYMENT_V2_JOURNAL_KEY,
        JSON.stringify(journal("attempt-ready")),
      );
      const nextRepository = createBookingPaymentRecoveryRecordsRepository({
        driver: harness.driver,
        now: () => initialNow,
      });
      expect(
        nextRepository.claimCallbackCredential(claimInput()),
      ).toMatchObject({ status: "claimed" });
    });

    it("preserves expired receipt authority behind forged or unknown/newer exact-state barriers", () => {
      const forged = createReceiptHarness();
      const forgedExpired = createBookingPaymentRecoveryRecordsRepository({
        driver: forged.driver,
        now: () => initialNow + 25 * 60 * 60_000,
      });
      expect(
        forgedExpired.claimReceiptLease(
          receiptInput({ lease: nextLease, operationId: paymentAttemptId }),
        ),
      ).toEqual({ status: "rejected", reason: "tuple-mismatch" });
      expect(forged.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );

      const opaque = createReceiptHarness();
      opaque.values.set("airbob:booking-payment-v2:future-record", "opaque");
      const opaqueExpired = createBookingPaymentRecoveryRecordsRepository({
        driver: opaque.driver,
        now: () => initialNow + 25 * 60 * 60_000,
      });
      expect(
        opaqueExpired.claimReceiptLease(receiptInput({ lease: nextLease })),
      ).toEqual({ status: "rejected", reason: "opaque-v2-state" });
      expect(opaque.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );
      expect(opaque.values.has("airbob:booking-payment-v2:future-record")).toBe(
        true,
      );
    });

    it("does not remove an expired receipt when lower-authority cleanup cannot be verified", () => {
      const harness = createReceiptHarness();
      harness.values.set(
        BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
        "expired-lower-secret",
      );
      const noOpDriver: SessionStorageDriver = {
        ...harness.driver,
        removeItem: (key) =>
          key === BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY
            ? { ok: true, value: undefined }
            : harness.driver.removeItem(key),
      };
      const expiredRepository = createBookingPaymentRecoveryRecordsRepository({
        driver: noOpDriver,
        now: () => initialNow + 25 * 60 * 60_000,
      });

      expect(
        expiredRepository.claimReceiptLease(receiptInput({ lease: nextLease })),
      ).toEqual({ status: "rejected", reason: "cleanup-not-verified" });
      expect(
        harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY),
      ).toBe(true);
      expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );
    });

    it("replaces only monotonic validated observations and never slides the receipt TTL", () => {
      const { repository, values } = createReceiptHarness();
      const pending = repository.replaceReceiptObservation({
        ...receiptInput(),
        observation: observation(),
      });
      const hardExpiresAt = (
        JSON.parse(
          values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY) ?? "null",
        ) as { hardExpiresAt: number }
      ).hardExpiresAt;

      const older = repository.replaceReceiptObservation({
        ...receiptInput(),
        observation: observation({
          updatedAt: "2026-09-01T10:00:59Z",
          serverTime: "2026-09-01T10:01:00Z",
        }),
      });
      const processing = repository.replaceReceiptObservation({
        ...receiptInput(),
        observation: observation({
          status: "PROCESSING",
          updatedAt: "2026-09-01T10:02:00Z",
          serverTime: "2026-09-01T10:02:01Z",
        }),
      });

      expect(pending.status).toBe("replaced");
      expect(older).toEqual({
        status: "rejected",
        reason: "observation-conflict",
      });
      expect(processing).toMatchObject({
        status: "replaced",
        authority: { observation: { status: "PROCESSING" } },
      });
      expect(
        JSON.parse(
          values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY) ?? "null",
        ),
      ).toMatchObject({ hardExpiresAt });
    });

    it("detects a receipt lease write race/no-op through raw equality", () => {
      const harness = createReceiptHarness();
      const noOpDriver: SessionStorageDriver = {
        ...harness.driver,
        setItem: (key, value) =>
          key === BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY
            ? { ok: true, value: undefined }
            : harness.driver.setItem(key, value),
      };
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: noOpDriver,
        now: () => initialNow,
      });

      expect(
        repository.claimReceiptLease(receiptInput({ lease: nextLease })),
      ).toEqual({ status: "rejected", reason: "write-not-verified" });
    });

    it("acknowledges only a durably observed SUCCEEDED or FAILED receipt", () => {
      const { repository, values } = createReceiptHarness();
      repository.replaceReceiptObservation({
        ...receiptInput(),
        observation: observation(),
      });

      expect(repository.acknowledgeTerminalReceipt(receiptInput())).toEqual({
        status: "rejected",
        reason: "not-terminal",
      });
      repository.replaceReceiptObservation({
        ...receiptInput(),
        observation: observation({
          status: "SUCCEEDED",
          updatedAt: "2026-09-01T10:02:00Z",
          nextAction: "NONE",
          retryAfterSeconds: null,
          serverTime: "2026-09-01T10:02:01Z",
        }),
      });

      expect(repository.acknowledgeTerminalReceipt(receiptInput())).toEqual({
        status: "cleared",
      });
      expect(values.size).toBe(0);
    });

    it.each(retiredKeys)(
      "payload-blind purges %s before removing the receipt",
      (retiredKey) => {
        const harness = createTerminalReceiptHarness();
        harness.values.set(retiredKey, `secret:${retiredKey}`);
        harness.values.set("airbob:booking-payment-v10:callback", "keep-v10");
        harness.values.set("airbob:reservation-checkouts:7", "keep-plural");
        harness.values.set("unrelated", "keep-unrelated");

        expect(
          harness.repository.acknowledgeTerminalReceipt(receiptInput()),
        ).toEqual({ status: "cleared" });
        expect(harness.calls).not.toContain(`get:${retiredKey}`);
        expect(harness.calls.indexOf(`remove:${retiredKey}`)).toBeLessThan(
          harness.calls.indexOf(
            `remove:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
          ),
        );
        expect([...harness.values]).toEqual([
          ["airbob:booking-payment-v10:callback", "keep-v10"],
          ["airbob:reservation-checkouts:7", "keep-plural"],
          ["unrelated", "keep-unrelated"],
        ]);
      },
    );

    it("verified-purges credential, journal and retired state before the receipt", () => {
      const harness = createTerminalReceiptHarness();
      harness.values.set(BOOKING_PAYMENT_V2_JOURNAL_KEY, "opaque-leftover");
      harness.values.set(
        BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
        "secret-leftover",
      );
      harness.values.set(retiredKeys[3], "retired-marker");

      expect(
        harness.repository.acknowledgeTerminalReceipt(receiptInput()),
      ).toEqual({ status: "cleared" });
      expect(
        harness.calls.filter((call) => call.startsWith("remove:")),
      ).toEqual([
        `remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
        `remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
        `remove:${retiredKeys[3]}`,
        `remove:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
      ]);
      expect(harness.calls).not.toContain(
        `get:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
      );
      expect(harness.calls).not.toContain(
        `get:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
      );
      expect(harness.calls).not.toContain(`get:${retiredKeys[3]}`);
    });

    it("retries a transient lower-authority removal and still removes the receipt last", () => {
      const harness = createTerminalReceiptHarness();
      const retiredKey = retiredKeys[0];
      harness.values.set(retiredKey, "secret-v1-callback");
      let removalAttempts = 0;
      const transientDriver: SessionStorageDriver = {
        ...harness.driver,
        removeItem: (key) => {
          if (key === retiredKey && ++removalAttempts === 1) {
            harness.calls.push(`remove:${key}`);
            return {
              ok: false,
              error: { kind: "storage-unavailable", operation: "remove" },
            };
          }
          return harness.driver.removeItem(key);
        },
      };
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: transientDriver,
        now: () => initialNow,
      });

      expect(repository.acknowledgeTerminalReceipt(receiptInput())).toEqual({
        status: "cleared",
      });
      expect(removalAttempts).toBe(2);
      expect(harness.calls.at(-3)).toBe(
        `remove:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
      );
      expect(harness.values.size).toBe(0);
    });

    it("preserves the receipt after a persistent lower-authority removal failure", () => {
      const harness = createTerminalReceiptHarness();
      const retiredKey = retiredKeys[1];
      harness.values.set(retiredKey, "secret-retired-checkout");
      let removalAttempts = 0;
      const persistentDriver: SessionStorageDriver = {
        ...harness.driver,
        removeItem: (key) => {
          if (key === retiredKey) {
            removalAttempts += 1;
            harness.calls.push(`remove:${key}`);
            return {
              ok: false,
              error: { kind: "storage-unavailable", operation: "remove" },
            };
          }
          return harness.driver.removeItem(key);
        },
      };
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: persistentDriver,
        now: () => initialNow,
      });

      expect(repository.acknowledgeTerminalReceipt(receiptInput())).toEqual({
        status: "rejected",
        reason: "cleanup-not-verified",
      });
      expect(removalAttempts).toBe(2);
      expect(harness.values.has(retiredKey)).toBe(true);
      expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );
      expect(harness.calls).not.toContain(
        `remove:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
      );
      expect(harness.calls).not.toContain(`get:${retiredKey}`);
    });

    it("preserves the receipt when a lower key is inserted immediately before deletion", () => {
      const harness = createTerminalReceiptHarness();
      const insertedKey = retiredKeys[2];
      let keyReads = 0;
      const racingDriver: SessionStorageDriver = {
        ...harness.driver,
        keys: () => {
          keyReads += 1;
          // readReceiptAuthority, cleanup initial, cleanup verification,
          // then the dedicated immediately-before-receipt enumeration.
          if (keyReads === 4) {
            harness.values.set(insertedKey, "late-secret-index");
          }
          return harness.driver.keys();
        },
      };
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: racingDriver,
        now: () => initialNow,
      });

      expect(repository.acknowledgeTerminalReceipt(receiptInput())).toEqual({
        status: "rejected",
        reason: "cleanup-not-verified",
      });
      expect(harness.values.has(insertedKey)).toBe(true);
      expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );
      expect(harness.calls).not.toContain(`get:${insertedKey}`);
      expect(harness.calls).not.toContain(
        `remove:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
      );
    });

    it("preserves the receipt when lower-authority cleanup cannot be verified", () => {
      const harness = createReceiptHarness();
      harness.values.set(
        BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
        JSON.stringify({ version: 2 }),
      );
      const succeeded = observation({
        status: "SUCCEEDED",
        updatedAt: "2026-09-01T10:02:00Z",
        nextAction: "NONE",
        retryAfterSeconds: null,
        serverTime: "2026-09-01T10:02:01Z",
      });
      harness.repository.replaceReceiptObservation({
        ...receiptInput(),
        observation: succeeded,
      });
      const noOpDriver: SessionStorageDriver = {
        ...harness.driver,
        removeItem: (key) =>
          key === BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY
            ? { ok: true, value: undefined }
            : harness.driver.removeItem(key),
      };
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: noOpDriver,
        now: () => initialNow,
      });

      expect(repository.acknowledgeTerminalReceipt(receiptInput())).toEqual({
        status: "rejected",
        reason: "cleanup-not-verified",
      });
      expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );
    });

    it("does not acknowledge a receipt whose observation changes during verification", () => {
      const harness = createReceiptHarness();
      harness.repository.replaceReceiptObservation({
        ...receiptInput(),
        observation: observation({
          status: "SUCCEEDED",
          updatedAt: "2026-09-01T10:02:00Z",
          nextAction: "NONE",
          retryAfterSeconds: null,
          serverTime: "2026-09-01T10:02:01Z",
        }),
      });
      let receiptReads = 0;
      const racingDriver: SessionStorageDriver = {
        ...harness.driver,
        getItem: (key) => {
          if (
            key === BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY &&
            ++receiptReads === 2
          ) {
            const current = JSON.parse(
              harness.values.get(key) ?? "null",
            ) as Record<string, unknown> & {
              data: Record<string, unknown>;
            };
            harness.values.set(
              key,
              JSON.stringify({
                ...current,
                data: {
                  ...current.data,
                  observation: observation({
                    updatedAt: "2026-09-01T10:03:00Z",
                    serverTime: "2026-09-01T10:03:01Z",
                  }),
                },
              }),
            );
          }
          return harness.driver.getItem(key);
        },
      };
      const repository = createBookingPaymentRecoveryRecordsRepository({
        driver: racingDriver,
        now: () => initialNow,
      });

      expect(repository.acknowledgeTerminalReceipt(receiptInput())).toEqual({
        status: "rejected",
        reason: "observation-conflict",
      });
      expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );
    });

    it("rejects expired, stale-document and unknown-slot commands without receipt mutation", () => {
      const harness = createReceiptHarness();
      const before = harness.values.get(
        BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
      );
      harness.values.set("airbob:booking-payment-v2:future", "{}");

      expect(harness.repository.readReceiptAuthority(receiptInput())).toEqual({
        status: "rejected",
        reason: "opaque-v2-state",
      });
      expect(
        harness.repository.replaceReceiptObservation({
          ...receiptInput({ isCurrent: () => false }),
          observation: observation(),
        }),
      ).toEqual({ status: "stale" });
      expect(harness.values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        before,
      );

      harness.values.delete("airbob:booking-payment-v2:future");
      const expiredRepository = createBookingPaymentRecoveryRecordsRepository({
        driver: harness.driver,
        now: () => initialNow + 25 * 60 * 60_000,
      });
      expect(expiredRepository.readReceiptAuthority(receiptInput())).toEqual({
        status: "rejected",
        reason: "expired",
      });
    });
  });
});
