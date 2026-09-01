import type { SessionStorageDriver } from "../../../platform/storage/sessionStorageDriver";
import type {
  BookingPaymentAttempt,
  BookingPaymentJournalData,
  BookingPaymentJournalEnvelope,
  BookingPaymentQuote,
  BookingPaymentReady,
} from "./types";
import type {
  BookingPaymentCallbackCredentialData,
  BookingPaymentCallbackCredentialEnvelope,
  BookingPaymentOperationReceiptEnvelope,
} from "./recoveryRecordsTypes";
import { bookingPaymentRecoveryRecordValidation } from "./recoveryRecordsValidation";
import { reconcileBookingPaymentCandidateOwner } from "./candidateReconciliation";
import {
  BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
  BOOKING_PAYMENT_V2_JOURNAL_KEY,
  BOOKING_PAYMENT_V2_NAMESPACE_PREFIX,
  BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
} from "./namespace";
import {
  BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
  isBookingPaymentJournalEnvelope,
} from "./validation";

const {
  BOOKING_PAYMENT_CALLBACK_CREDENTIAL_MAX_TTL_MS,
  BOOKING_PAYMENT_OPERATION_RECEIPT_HARD_TTL_MS,
  isBookingPaymentCallbackCredentialEnvelope,
  isBookingPaymentOperationReceiptEnvelope,
} = bookingPaymentRecoveryRecordValidation;

const journalCreatedAt = Date.parse("2026-09-01T10:00:00Z");
const callbackCreatedAt = Date.parse("2026-09-01T10:01:00Z");
const receiptCreatedAt = Date.parse("2026-09-01T10:01:30Z");
const currentTime = Date.parse("2026-09-01T10:02:00Z");
const recoveryExpiresAt = Date.parse("2026-09-01T10:15:00Z");

const owner = "subject:member_a";
const foreignOwner = "subject:member_b";
const flowId = "10000000-0000-4000-8000-000000000001";
const quoteUid = "20000000-0000-4000-8000-000000000002";
const reservationUid = "30000000-0000-4000-8000-000000000003";
const paymentAttemptId = "40000000-0000-4000-8000-000000000004";
const operationId = "50000000-0000-4000-8000-000000000005";
const otherPaymentAttemptId = "90000000-0000-4000-8000-000000000009";
const paymentKey = "provider-secret-that-must-never-leave-storage";
const orderName = "Sensitive stay name that must stay in storage";
const legacyCheckoutKey = "airbob:booking-payment-v1:checkout";
const legacyCallbackKey = "airbob:booking-payment-v1:callback";

const quote: BookingPaymentQuote = {
  quoteUid,
  accommodationId: 7,
  orderName,
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
  orderName,
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
  expiresAt = recoveryExpiresAt,
): Extract<BookingPaymentJournalData, { readonly phase: "attempt-ready" }> => ({
  phase: "attempt-ready",
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
  recoveryExpiresAt: expiresAt,
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
  overrides: {
    readonly owner?: string;
    readonly createdAt?: number;
    readonly recoveryExpiresAt?: number;
  } = {},
): BookingPaymentJournalEnvelope => {
  const createdAt = overrides.createdAt ?? journalCreatedAt;
  return {
    purpose: "booking-payment-journal",
    version: 2,
    privacyClass: "sensitive",
    containsPii: false,
    owner: overrides.owner ?? owner,
    createdAt,
    hardExpiresAt: createdAt + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
    lease: {
      runtimeLeaseId: "60000000-0000-4000-8000-000000000006",
      sessionEpoch: 4,
    },
    data: journalData(overrides.recoveryExpiresAt),
  };
};

const credential = (
  envelopeOverrides: {
    readonly owner?: string;
    readonly createdAt?: number;
    readonly hardExpiresAt?: number;
  } = {},
  dataOverrides: Partial<BookingPaymentCallbackCredentialData> = {},
): BookingPaymentCallbackCredentialEnvelope => {
  const createdAt = envelopeOverrides.createdAt ?? callbackCreatedAt;
  return {
    purpose: "booking-payment-callback-credential",
    version: 2,
    privacyClass: "sensitive",
    containsPii: false,
    owner: envelopeOverrides.owner ?? owner,
    createdAt,
    hardExpiresAt:
      envelopeOverrides.hardExpiresAt ??
      createdAt + BOOKING_PAYMENT_CALLBACK_CREDENTIAL_MAX_TTL_MS,
    data: {
      flowId,
      reservationUid,
      orderId: reservationUid,
      paymentAttemptId,
      paymentKey,
      amount: 1_900,
      currency: "KRW",
      ...dataOverrides,
    },
  };
};

const receipt = (
  overrides: {
    readonly owner?: string;
    readonly createdAt?: number;
    readonly hardExpiresAt?: number;
  } = {},
): BookingPaymentOperationReceiptEnvelope => {
  const createdAt = overrides.createdAt ?? receiptCreatedAt;
  return {
    purpose: "booking-payment-operation-receipt",
    version: 2,
    privacyClass: "personal",
    containsPii: false,
    owner: overrides.owner ?? owner,
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
  };
};

type StorageOperation = "get" | "set" | "remove" | "keys";

const storageFailure = (operation: StorageOperation) => ({
  ok: false as const,
  error: { kind: "storage-unavailable" as const, operation },
});

const createStorageHarness = (entries: Record<string, string> = {}) => {
  const values = new Map(Object.entries(entries));
  const calls: string[] = [];
  const driver: SessionStorageDriver = {
    getItem: vi.fn((key: string) => {
      calls.push(`get:${key}`);
      return { ok: true as const, value: values.get(key) ?? null };
    }),
    setItem: vi.fn((key: string, value: string) => {
      calls.push(`set:${key}`);
      values.set(key, value);
      return { ok: true as const, value: undefined };
    }),
    removeItem: vi.fn((key: string) => {
      calls.push(`remove:${key}`);
      values.delete(key);
      return { ok: true as const, value: undefined };
    }),
    keys: vi.fn(() => {
      calls.push("keys");
      return { ok: true as const, value: [...values.keys()] };
    }),
  };

  return { calls, driver, values };
};

type StorageHarness = ReturnType<typeof createStorageHarness>;

const expectNoSensitiveResult = (result: unknown): void => {
  const serialized = JSON.stringify(result);
  for (const secret of [
    paymentKey,
    orderName,
    operationId,
    reservationUid,
    paymentAttemptId,
  ]) {
    expect(serialized).not.toContain(secret);
  }
};

const reconcile = (
  harness: StorageHarness,
  options: {
    readonly candidateOwner?: string;
    readonly now?: () => number;
  } = {},
) => {
  const result = reconcileBookingPaymentCandidateOwner({
    driver: harness.driver,
    now: options.now ?? (() => currentTime),
    owner: options.candidateOwner ?? owner,
  });
  expectNoSensitiveResult(result);
  return result;
};

const raw = (value: unknown): string => JSON.stringify(value);

const v2Malformed = (purpose: string): string =>
  raw({
    purpose,
    version: 2,
    paymentKey,
    rawProviderMessage: "never expose this malformed payload",
  });

const newerRecord = (purpose: string): string =>
  raw({ purpose, version: 3, paymentKey });

const removeCalls = (harness: StorageHarness): string[] =>
  harness.calls.filter((call) => call.startsWith("remove:"));

describe("booking-payment candidate owner reconciliation", () => {
  it("uses exact valid fixtures for the journal, credential and receipt slots", () => {
    expect(isBookingPaymentJournalEnvelope(journal())).toBe(true);
    expect(isBookingPaymentCallbackCredentialEnvelope(credential())).toBe(true);
    expect(isBookingPaymentOperationReceiptEnvelope(receipt())).toBe(true);
  });

  it("is ready when the exact v2 namespace has no slots", () => {
    const harness = createStorageHarness({ unrelated: "keep" });

    expect(reconcile(harness)).toEqual({ status: "ready" });
    expect(harness.values.get("unrelated")).toBe("keep");
  });

  it("requires recovery for an active same-owner journal alone", () => {
    const journalRaw = raw(journal());
    const harness = createStorageHarness({
      [BOOKING_PAYMENT_V2_JOURNAL_KEY]: journalRaw,
    });

    expect(reconcile(harness)).toEqual({ status: "recovery-required" });
    expect(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(journalRaw);
    expect(removeCalls(harness)).toEqual([]);
  });

  it("requires recovery for an exact active journal and joined credential", () => {
    const journalRaw = raw(journal());
    const credentialRaw = raw(credential());
    const harness = createStorageHarness({
      [BOOKING_PAYMENT_V2_JOURNAL_KEY]: journalRaw,
      [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: credentialRaw,
    });

    expect(reconcile(harness)).toEqual({ status: "recovery-required" });
    expect(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(journalRaw);
    expect(harness.values.get(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY)).toBe(
      credentialRaw,
    );
    expect(removeCalls(harness)).toEqual([]);
  });

  it("returns only recovery-required for an active same-owner receipt", () => {
    const receiptRaw = raw(receipt());
    const harness = createStorageHarness({
      [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: receiptRaw,
    });

    const result = reconcile(harness);

    expect(result).toEqual({ status: "recovery-required" });
    expect(Object.keys(result)).toEqual(["status"]);
    expect(harness.values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      receiptRaw,
    );
    expect(removeCalls(harness)).toEqual([]);
  });

  it("purges legacy confirm-capable state before preserving an active v2 receipt", () => {
    const receiptRaw = raw(receipt());
    const harness = createStorageHarness({
      [legacyCheckoutKey]: "opaque-legacy-checkout",
      [legacyCallbackKey]: "opaque-legacy-received-callback",
      [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: receiptRaw,
    });

    expect(reconcile(harness)).toEqual({ status: "recovery-required" });
    expect(harness.values.has(legacyCheckoutKey)).toBe(false);
    expect(harness.values.has(legacyCallbackKey)).toBe(false);
    expect(harness.values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      receiptRaw,
    );
    expect(removeCalls(harness)).toEqual([
      `remove:${legacyCheckoutKey}`,
      `remove:${legacyCallbackKey}`,
    ]);
  });

  it("preserves the v2 receipt when legacy state cannot be verified-cleaned", () => {
    const receiptRaw = raw(receipt());
    const harness = createStorageHarness({
      [legacyCallbackKey]: "opaque-legacy-received-callback",
      [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: receiptRaw,
    });
    vi.mocked(harness.driver.removeItem).mockImplementation((key) => {
      harness.calls.push(`remove:${key}`);
      if (key !== legacyCallbackKey) harness.values.delete(key);
      return { ok: true, value: undefined };
    });

    expect(reconcile(harness)).toEqual({
      status: "blocked",
      reason: "cleanup-not-verified",
    });
    expect(harness.values.get(legacyCallbackKey)).toBe(
      "opaque-legacy-received-callback",
    );
    expect(harness.values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      receiptRaw,
    );
    expect(removeCalls(harness)).toEqual([
      `remove:${legacyCallbackKey}`,
      `remove:${legacyCallbackKey}`,
    ]);
  });

  it.each([
    [
      "joined records",
      {
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(credential()),
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw(journal()),
      },
      [
        `remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
        `remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
      ],
    ],
    [
      "expired credential",
      {
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(
          credential({ hardExpiresAt: currentTime - 1 }),
        ),
      },
      [`remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`],
    ],
    [
      "foreign credential",
      {
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(
          credential({ owner: foreignOwner }),
        ),
      },
      [`remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`],
    ],
    [
      "mismatched credential",
      {
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(
          credential({}, { paymentAttemptId: otherPaymentAttemptId }),
        ),
      },
      [`remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`],
    ],
    [
      "exact-v2 malformed credential",
      {
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: v2Malformed(
          "booking-payment-callback-credential",
        ),
      },
      [`remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`],
    ],
    [
      "foreign journal",
      {
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw(journal({ owner: foreignOwner })),
      },
      [`remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`],
    ],
    [
      "exact-v2 malformed journal",
      {
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: v2Malformed(
          "booking-payment-journal",
        ),
      },
      [`remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`],
    ],
  ])(
    "cleans %s beside an active receipt without losing receipt authority",
    (_label, leftovers, expectedRemovals) => {
      const receiptRaw = raw(receipt());
      const harness = createStorageHarness({
        ...leftovers,
        [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: receiptRaw,
      });

      const result = reconcile(harness);

      expect(result).toEqual({ status: "recovery-required" });
      expect(Object.keys(result)).toEqual(["status"]);
      expect(harness.values).toEqual(
        new Map([[BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY, receiptRaw]]),
      );
      expect(removeCalls(harness)).toEqual(expectedRemovals);
    },
  );

  it("removes an orphan callback credential before reporting ready", () => {
    const harness = createStorageHarness({
      [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(credential()),
    });

    expect(reconcile(harness)).toEqual({ status: "ready" });
    expect(harness.values.size).toBe(0);
    expect(removeCalls(harness)).toEqual([
      `remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
    ]);
  });

  it.each([
    ["expired", raw(credential({ hardExpiresAt: currentTime - 1 }))],
    ["exact-v2 malformed", v2Malformed("booking-payment-callback-credential")],
    ["foreign", raw(credential({ owner: foreignOwner }))],
    [
      "mismatched",
      raw(credential({}, { paymentAttemptId: otherPaymentAttemptId })),
    ],
  ])(
    "removes only an %s credential beside a live same-owner journal",
    (_label, credentialRaw) => {
      const journalRaw = raw(journal());
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: journalRaw,
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: credentialRaw,
      });

      expect(reconcile(harness)).toEqual({ status: "recovery-required" });
      expect(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(
        journalRaw,
      );
      expect(
        harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY),
      ).toBe(false);
      expect(removeCalls(harness)).toEqual([
        `remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
      ]);
    },
  );

  describe("operation receipt barrier", () => {
    it("lets an active receipt purge a foreign journal without using it as fallback authority", () => {
      const foreignJournalRaw = raw(journal({ owner: foreignOwner }));
      const receiptRaw = raw(receipt());
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: foreignJournalRaw,
        [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: receiptRaw,
      });

      expect(reconcile(harness)).toEqual({ status: "recovery-required" });
      expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
      expect(harness.values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        receiptRaw,
      );
      expect(removeCalls(harness)).toEqual([
        `remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
      ]);
    });

    it("cleans an expired same-owner receipt last and reports unavailable recovery", () => {
      const expiredReceipt = receipt({
        createdAt: currentTime - BOOKING_PAYMENT_OPERATION_RECEIPT_HARD_TTL_MS,
        hardExpiresAt: currentTime,
      });
      const harness = createStorageHarness({
        [legacyCheckoutKey]: "opaque-legacy-checkout",
        [legacyCallbackKey]: "opaque-legacy-received-callback",
        [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: raw(expiredReceipt),
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw(journal()),
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(credential()),
      });

      expect(reconcile(harness)).toEqual({ status: "recovery-unavailable" });
      expect(harness.values.size).toBe(0);
      expect(removeCalls(harness)).toEqual([
        `remove:${legacyCheckoutKey}`,
        `remove:${legacyCallbackKey}`,
        `remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
        `remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
        `remove:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
      ]);

      const reloadedRuntime = createStorageHarness(
        Object.fromEntries(harness.values),
      );
      expect(reconcile(reloadedRuntime)).toEqual({ status: "ready" });
      expect(reloadedRuntime.values.has(legacyCheckoutKey)).toBe(false);
      expect(reloadedRuntime.values.has(legacyCallbackKey)).toBe(false);
    });

    it("cleans an exact-v2 malformed receipt last and reports unavailable recovery", () => {
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: v2Malformed(
          "booking-payment-operation-receipt",
        ),
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw(journal()),
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(credential()),
      });

      expect(reconcile(harness)).toEqual({ status: "recovery-unavailable" });
      expect(harness.values.size).toBe(0);
      expect(removeCalls(harness)).toEqual([
        `remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
        `remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
        `remove:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
      ]);
    });

    it("cleans all records for a valid foreign receipt and reports ready", () => {
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: raw(
          receipt({ owner: foreignOwner }),
        ),
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw(journal()),
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(credential()),
      });

      expect(reconcile(harness)).toEqual({ status: "ready" });
      expect(harness.values.size).toBe(0);
      expect(removeCalls(harness)).toEqual([
        `remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
        `remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
        `remove:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
      ]);
    });

    it.each([
      ["unknown", "not-json-with-provider-secret"],
      ["newer", newerRecord("booking-payment-operation-receipt")],
    ])("preserves an %s receipt and blocks recovery", (_label, receiptRaw) => {
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: receiptRaw,
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw(journal()),
      });
      const before = [...harness.values];

      expect(reconcile(harness)).toEqual({
        status: "blocked",
        reason:
          _label === "newer" ? "newer-version" : "malformed-unknown-version",
      });
      expect([...harness.values]).toEqual(before);
      expect(removeCalls(harness)).toEqual([]);
    });

    it.each([
      [BOOKING_PAYMENT_V2_JOURNAL_KEY, "booking-payment-journal"],
      [
        BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
        "booking-payment-callback-credential",
      ],
    ])(
      "preserves a live receipt and newer known leftover at %s",
      (key, purpose) => {
        const receiptRaw = raw(receipt());
        const newerRaw = newerRecord(purpose);
        const harness = createStorageHarness({
          [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: receiptRaw,
          [key]: newerRaw,
        });

        expect(reconcile(harness)).toEqual({
          status: "blocked",
          reason: "newer-version",
        });
        expect(
          harness.values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY),
        ).toBe(receiptRaw);
        expect(harness.values.get(key)).toBe(newerRaw);
        expect(removeCalls(harness)).toEqual([]);
      },
    );
  });

  describe("pre-Accepted journal cleanup", () => {
    it.each([
      ["foreign", raw(journal({ owner: foreignOwner }))],
      ["expired", raw(journal({ recoveryExpiresAt: currentTime }))],
      ["exact-v2 malformed", v2Malformed("booking-payment-journal")],
    ])(
      "removes credential before an %s journal and reports ready",
      (_label, journalRaw) => {
        const harness = createStorageHarness({
          [BOOKING_PAYMENT_V2_JOURNAL_KEY]: journalRaw,
          [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(credential()),
        });

        expect(reconcile(harness)).toEqual({ status: "ready" });
        expect(harness.values.size).toBe(0);
        expect(removeCalls(harness)).toEqual([
          `remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
          `remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
        ]);
      },
    );

    it.each([
      ["unknown", "opaque-journal-without-version"],
      ["newer", newerRecord("booking-payment-journal")],
    ])("preserves an %s journal and blocks recovery", (_label, journalRaw) => {
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: journalRaw,
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(credential()),
      });
      const before = [...harness.values];

      expect(reconcile(harness)).toEqual({
        status: "blocked",
        reason:
          _label === "newer" ? "newer-version" : "malformed-unknown-version",
      });
      expect([...harness.values]).toEqual(before);
      expect(removeCalls(harness)).toEqual([]);
    });
  });

  it("blocks on an unknown exact-prefix key before reading or removing any payload", () => {
    const unknownKey = `${BOOKING_PAYMENT_V2_NAMESPACE_PREFIX}future-record`;
    const harness = createStorageHarness({
      [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw(journal()),
      [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: raw(receipt()),
      [unknownKey]: `opaque-${paymentKey}`,
    });

    expect(reconcile(harness)).toEqual({
      status: "blocked",
      reason: "unknown-v2-state",
    });
    expect(harness.driver.getItem).not.toHaveBeenCalled();
    expect(harness.driver.removeItem).not.toHaveBeenCalled();
    expect(harness.values.get(unknownKey)).toBe(`opaque-${paymentKey}`);
  });

  it("ignores and preserves near-collision keys outside the exact prefix", () => {
    const entries = {
      "airbob:booking-payment-v20:journal": paymentKey,
      "airbob:booking-payment-v2": "near-collision",
      "airbob:booking-payment-v2x:operation-receipt": raw(receipt()),
    };
    const harness = createStorageHarness(entries);

    expect(reconcile(harness)).toEqual({ status: "ready" });
    expect(Object.fromEntries(harness.values)).toEqual(entries);
    expect(harness.driver.getItem).not.toHaveBeenCalled();
    expect(harness.driver.removeItem).not.toHaveBeenCalled();
  });

  describe("storage and clock failures", () => {
    it("fails closed when namespace enumeration fails", () => {
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw(journal()),
      });
      vi.spyOn(harness.driver, "keys").mockReturnValue(storageFailure("keys"));

      expect(reconcile(harness)).toEqual({
        status: "storage-error",
        error: { kind: "storage-unavailable", operation: "keys" },
      });
      expect(harness.driver.getItem).not.toHaveBeenCalled();
      expect(harness.driver.removeItem).not.toHaveBeenCalled();
    });

    it.each([
      [BOOKING_PAYMENT_V2_JOURNAL_KEY, raw(journal())],
      [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY, raw(credential())],
      [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY, raw(receipt())],
    ])("fails closed when reading %s fails", (key, value) => {
      const harness = createStorageHarness({ [key]: value });
      vi.spyOn(harness.driver, "getItem").mockReturnValue(
        storageFailure("get"),
      );

      expect(reconcile(harness)).toEqual({
        status: "storage-error",
        error: { kind: "storage-unavailable", operation: "get" },
      });
      expect(harness.driver.removeItem).not.toHaveBeenCalled();
    });

    it("fails closed when cleanup removal fails", () => {
      const credentialRaw = raw(credential());
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: credentialRaw,
      });
      vi.spyOn(harness.driver, "removeItem").mockReturnValue(
        storageFailure("remove"),
      );

      expect(reconcile(harness)).toEqual({
        status: "storage-error",
        error: { kind: "storage-unavailable", operation: "remove" },
      });
      expect(
        harness.values.get(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY),
      ).toBe(credentialRaw);
    });

    it("keeps an active receipt authoritative when lower-record cleanup fails", () => {
      const credentialRaw = raw(credential());
      const receiptRaw = raw(receipt());
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: credentialRaw,
        [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: receiptRaw,
      });
      vi.spyOn(harness.driver, "removeItem").mockReturnValue(
        storageFailure("remove"),
      );

      expect(reconcile(harness)).toEqual({
        status: "storage-error",
        error: { kind: "storage-unavailable", operation: "remove" },
      });
      expect(harness.values).toEqual(
        new Map([
          [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY, credentialRaw],
          [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY, receiptRaw],
        ]),
      );
    });

    it("blocks publication when an active receipt cannot be re-verified after cleanup", () => {
      const receiptRaw = raw(receipt());
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(credential()),
        [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: receiptRaw,
      });
      let receiptReads = 0;
      vi.mocked(harness.driver.getItem).mockImplementation((key) => {
        harness.calls.push(`get:${key}`);
        if (key === BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY) {
          receiptReads += 1;
          if (receiptReads === 2) return storageFailure("get");
        }
        return { ok: true, value: harness.values.get(key) ?? null };
      });

      expect(reconcile(harness)).toEqual({
        status: "storage-error",
        error: { kind: "storage-unavailable", operation: "get" },
      });
      expect(harness.values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        receiptRaw,
      );
      expect(
        harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY),
      ).toBe(false);
    });

    it("fails closed when post-remove read-back fails", () => {
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(credential()),
      });
      vi.mocked(harness.driver.getItem).mockImplementation((key) => {
        harness.calls.push(`get:${key}`);
        return harness.values.has(key)
          ? { ok: true, value: harness.values.get(key) ?? null }
          : storageFailure("get");
      });

      expect(reconcile(harness)).toEqual({
        status: "storage-error",
        error: { kind: "storage-unavailable", operation: "get" },
      });
      expect(harness.values.size).toBe(0);
    });

    it("rejects a success-returning no-op removal that cannot be verified", () => {
      const credentialRaw = raw(credential());
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: credentialRaw,
      });
      vi.spyOn(harness.driver, "removeItem").mockReturnValue({
        ok: true,
        value: undefined,
      });

      expect(reconcile(harness)).toEqual({
        status: "blocked",
        reason: "cleanup-not-verified",
      });
      expect(
        harness.values.get(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY),
      ).toBe(credentialRaw);
    });

    it("blocks when a key disappears between enumeration and payload read", () => {
      const harness = createStorageHarness();
      vi.spyOn(harness.driver, "keys").mockReturnValue({
        ok: true,
        value: [BOOKING_PAYMENT_V2_JOURNAL_KEY],
      });

      expect(reconcile(harness)).toEqual({
        status: "blocked",
        reason: "unknown-v2-state",
      });
      expect(harness.driver.removeItem).not.toHaveBeenCalled();
    });

    it.each([
      ["invalid", () => Number.NaN],
      [
        "throwing",
        () => {
          throw new Error(`${paymentKey} must not escape through the result`);
        },
      ],
    ])("blocks an active journal when the clock is %s", (_label, now) => {
      const journalRaw = raw(journal());
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: journalRaw,
      });

      expect(reconcile(harness, { now })).toEqual({
        status: "blocked",
        reason: "invalid-clock",
      });
      expect(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(
        journalRaw,
      );
      expect(harness.driver.removeItem).not.toHaveBeenCalled();
    });

    it("blocks an active receipt when the clock throws", () => {
      const receiptRaw = raw(receipt());
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: receiptRaw,
      });

      expect(
        reconcile(harness, {
          now: () => {
            throw new Error(paymentKey);
          },
        }),
      ).toEqual({ status: "blocked", reason: "invalid-clock" });
      expect(harness.values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        receiptRaw,
      );
      expect(harness.driver.removeItem).not.toHaveBeenCalled();
    });

    it.each([
      [
        "journal",
        {
          [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw(
            journal({ createdAt: currentTime + 1 }),
          ),
        },
      ],
      [
        "joined credential",
        {
          [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw(journal()),
          [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(
            credential({ createdAt: currentTime + 1 }),
          ),
        },
      ],
      [
        "receipt",
        {
          [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: raw(
            receipt({ createdAt: currentTime + 1 }),
          ),
        },
      ],
    ])(
      "preserves and blocks a same-owner future-dated %s",
      (_label, entries) => {
        const harness = createStorageHarness(entries);
        const before = new Map(harness.values);

        expect(reconcile(harness)).toEqual({
          status: "blocked",
          reason: "invalid-clock",
        });
        expect(harness.values).toEqual(before);
        expect(harness.driver.removeItem).not.toHaveBeenCalled();
      },
    );

    it("requires a final successful re-enumeration after verified cleanup", () => {
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(credential()),
      });
      vi.mocked(harness.driver.keys).mockImplementation(() => {
        harness.calls.push("keys");
        return harness.values.size === 0
          ? storageFailure("keys")
          : { ok: true, value: [...harness.values.keys()] };
      });

      expect(reconcile(harness)).toEqual({
        status: "storage-error",
        error: { kind: "storage-unavailable", operation: "keys" },
      });
      expect(harness.values.size).toBe(0);
      expect(harness.calls.at(-1)).toBe("keys");
    });

    it("keeps receipt-last cleanup order and proves the resulting namespace by re-enumeration", () => {
      const malformedReceipt = v2Malformed("booking-payment-operation-receipt");
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]: malformedReceipt,
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw(journal()),
        [BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY]: raw(credential()),
      });

      expect(reconcile(harness)).toEqual({ status: "recovery-unavailable" });
      expect(removeCalls(harness)).toEqual([
        `remove:${BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY}`,
        `remove:${BOOKING_PAYMENT_V2_JOURNAL_KEY}`,
        `remove:${BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY}`,
      ]);
      expect(harness.calls.at(-1)).toBe("keys");
      expect(harness.values.size).toBe(0);
    });
  });
});
