import { createSessionStorageDriver } from "../../../platform/storage/sessionStorageDriverCore";
import type {
  BookingPaymentAttempt,
  BookingPaymentCheckout,
  BookingPaymentJournalData,
  BookingPaymentJournalEnvelope,
  BookingPaymentQuote,
  BookingPaymentReady,
  BookingPaymentRecoveryLocator,
  BookingPaymentRuntimeLease,
} from "./types";
import {
  createBookingPaymentJournalRepository,
  inspectBookingPaymentV2NamespaceForLegacyWriter,
} from "./repository";
import { BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS } from "./validation";

const initialNow = Date.parse("2026-09-01T10:00:00Z");
const BOOKING_PAYMENT_V2_JOURNAL_KEY = "airbob:booking-payment-v2:journal";
const owner = "subject:member_a";
const otherOwner = "subject:member_b";
const flowId = "10000000-0000-4000-8000-000000000001";
const quoteUid = "20000000-0000-4000-8000-000000000002";
const reservationUid = "30000000-0000-4000-8000-000000000003";
const attemptId = "40000000-0000-4000-8000-000000000004";
const nextFlowId = "90000000-0000-4000-8000-000000000009";
const nextQuoteUid = "a0000000-0000-4000-8000-00000000000a";
const lease: BookingPaymentRuntimeLease = {
  runtimeLeaseId: "60000000-0000-4000-8000-000000000006",
  sessionEpoch: 4,
};
const replacementLease: BookingPaymentRuntimeLease = {
  runtimeLeaseId: "70000000-0000-4000-8000-000000000007",
  sessionEpoch: 4,
};
const accommodationLocator: BookingPaymentRecoveryLocator = {
  kind: "accommodation",
  accommodationId: 7,
};
const reservationLocator: BookingPaymentRecoveryLocator = {
  kind: "reservation",
  reservationUid,
};

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

const createStorageHarness = (entries: Record<string, string> = {}) => {
  const values = new Map(Object.entries(entries));
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
  return {
    values,
    storage,
    driver: createSessionStorageDriver({ getStorage: () => storage }),
  };
};

const createQuotedInput = (
  isCurrent: () => boolean = () => true,
  quoteValue: BookingPaymentQuote = quote(),
) => ({
  owner,
  lease,
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
  quote: quoteValue,
  isCurrent,
});

const createNextQuotedInput = (isCurrent: () => boolean = () => true) => ({
  ...createQuotedInput(isCurrent, quote({ quoteUid: nextQuoteUid })),
  flowId: nextFlowId,
  lease: replacementLease,
});

const authority = (
  isCurrent: () => boolean = () => true,
  overrides: Partial<{
    owner: string;
    lease: BookingPaymentRuntimeLease;
    flowId: string;
    locator: BookingPaymentRecoveryLocator;
  }> = {},
) => ({
  owner,
  lease,
  flowId,
  locator: accommodationLocator,
  isCurrent,
  ...overrides,
});

const reservationReadyData = (): Extract<
  BookingPaymentJournalData,
  { readonly phase: "reservation-ready" }
> => ({
  phase: "reservation-ready",
  flowId,
  serverIntent: createQuotedInput().serverIntent,
  presentationIntent: createQuotedInput().presentationIntent,
  recoveryExpiresAt: initialNow + 15 * 60_000,
  quote: quote(),
  checkout,
  ready: ready(),
});

const journalEnvelope = (
  data: BookingPaymentJournalData,
): BookingPaymentJournalEnvelope => ({
  purpose: "booking-payment-journal",
  version: 2,
  privacyClass: "sensitive",
  containsPii: false,
  owner,
  createdAt: initialNow,
  hardExpiresAt: initialNow + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
  lease,
  data,
});

const requireWritten = (
  result: ReturnType<
    ReturnType<typeof createBookingPaymentJournalRepository>["createQuoted"]
  >,
): BookingPaymentJournalEnvelope => {
  expect(result.status).toBe("written");
  if (result.status !== "written")
    throw new Error("Expected a written journal");
  return result.record;
};

describe("booking-payment v2 namespace downgrade inspector", () => {
  it("is ready only when the exact namespace contains no keys", () => {
    const harness = createStorageHarness({
      "airbob:booking-payment-v20:journal": "keep",
      "airbob:booking-payment-v2": "near-collision",
      unrelated: "keep",
    });
    expect(
      inspectBookingPaymentV2NamespaceForLegacyWriter({
        driver: harness.driver,
      }),
    ).toEqual({ status: "ready" });
  });

  it.each([
    BOOKING_PAYMENT_V2_JOURNAL_KEY,
    "airbob:booking-payment-v2:callback-credential",
    "airbob:booking-payment-v2:unknown-future-slot",
  ])("blocks opaquely for %s without reading or deleting payloads", (key) => {
    const harness = createStorageHarness({ [key]: "secret-newer-payload" });
    const getItem = vi.spyOn(harness.driver, "getItem");
    const removeItem = vi.spyOn(harness.driver, "removeItem");
    expect(
      inspectBookingPaymentV2NamespaceForLegacyWriter({
        driver: harness.driver,
      }),
    ).toEqual({ status: "blocked", reason: "v2-state-present" });
    expect(getItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(harness.values.get(key)).toBe("secret-newer-payload");
  });

  it("blocks on enumeration failure without any payload access", () => {
    const harness = createStorageHarness();
    vi.spyOn(harness.driver, "keys").mockReturnValue({
      ok: false,
      error: { kind: "storage-unavailable", operation: "keys" },
    });
    const getItem = vi.spyOn(harness.driver, "getItem");
    const removeItem = vi.spyOn(harness.driver, "removeItem");
    expect(
      inspectBookingPaymentV2NamespaceForLegacyWriter({
        driver: harness.driver,
      }),
    ).toEqual({
      status: "blocked",
      reason: "storage-error",
      error: { kind: "storage-unavailable", operation: "keys" },
    });
    expect(getItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});

describe("booking-payment journal repository", () => {
  it("creates the exact envelope with server-relative quote TTL and raw read-back", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    const record = requireWritten(repository.createQuoted(createQuotedInput()));

    expect(record).toEqual({
      purpose: "booking-payment-journal",
      version: 2,
      privacyClass: "sensitive",
      containsPii: false,
      owner,
      createdAt: initialNow,
      hardExpiresAt: initialNow + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
      lease,
      data: {
        phase: "quoted",
        flowId,
        serverIntent: createQuotedInput().serverIntent,
        presentationIntent: createQuotedInput().presentationIntent,
        recoveryExpiresAt: initialNow + 5 * 60 * 1000,
        quote: quote(),
      },
    });
    expect(
      JSON.parse(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY) ?? "null"),
    ).toEqual(record);
  });

  it("does not trust success-returning writes without exact raw equality", () => {
    const harness = createStorageHarness();
    vi.spyOn(harness.storage, "setItem").mockImplementation(() => undefined);
    const remove = vi.spyOn(harness.storage, "removeItem");
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });

    expect(repository.createQuoted(createQuotedInput())).toEqual({
      status: "rejected",
      reason: "write-not-verified",
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it("checks liveness before read, immediately before set and after read-back", () => {
    const beforeReadHarness = createStorageHarness();
    const beforeReadRepository = createBookingPaymentJournalRepository({
      driver: beforeReadHarness.driver,
      now: () => initialNow,
    });
    const beforeRead = vi.fn(() => false);
    expect(
      beforeReadRepository.createQuoted(createQuotedInput(beforeRead)),
    ).toEqual({
      status: "stale",
    });
    expect(beforeReadHarness.values.size).toBe(0);

    const beforeSetHarness = createStorageHarness();
    const beforeSetRepository = createBookingPaymentJournalRepository({
      driver: beforeSetHarness.driver,
      now: () => initialNow,
    });
    const beforeSet = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    expect(
      beforeSetRepository.createQuoted(createQuotedInput(beforeSet)),
    ).toEqual({
      status: "stale",
    });
    expect(beforeSetHarness.values.size).toBe(0);

    const afterReadBackHarness = createStorageHarness();
    const afterReadBackRepository = createBookingPaymentJournalRepository({
      driver: afterReadBackHarness.driver,
      now: () => initialNow,
    });
    const afterReadBack = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    expect(
      afterReadBackRepository.createQuoted(createQuotedInput(afterReadBack)),
    ).toEqual({ status: "stale" });
    expect(
      afterReadBackHarness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY),
    ).toBe(true);
  });

  it("blocks a fresh flow while the same-owner journal is active", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));
    const raw = harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY);

    expect(repository.createQuoted(createNextQuotedInput())).toEqual({
      status: "rejected",
      reason: "active-journal",
    });
    expect(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(raw);
  });

  it("verified-purges only a definitely expired same-owner journal before a fresh flow", () => {
    const harness = createStorageHarness();
    let currentTime = initialNow;
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => currentTime,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));
    currentTime += 5 * 60_000;

    expect(repository.createQuoted(createNextQuotedInput())).toMatchObject({
      status: "written",
      record: {
        owner,
        createdAt: currentTime,
        lease: replacementLease,
        data: { flowId: nextFlowId, quote: { quoteUid: nextQuoteUid } },
      },
    });
  });

  it("preserves foreign, malformed, newer and extra-slot v2 state", () => {
    const foreignHarness = createStorageHarness();
    const foreignRepository = createBookingPaymentJournalRepository({
      driver: foreignHarness.driver,
      now: () => initialNow,
    });
    requireWritten(foreignRepository.createQuoted(createQuotedInput()));
    expect(
      foreignRepository.createQuoted({
        ...createNextQuotedInput(),
        owner: otherOwner,
      }),
    ).toEqual({ status: "rejected", reason: "foreign-journal" });
    expect(foreignHarness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(
      true,
    );

    for (const entries of [
      { [BOOKING_PAYMENT_V2_JOURNAL_KEY]: "not-json" },
      {
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: JSON.stringify({ version: 3 }),
      },
      { "airbob:booking-payment-v2:future-slot": "opaque" },
      {
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: "opaque-journal",
        "airbob:booking-payment-v2:future-slot": "opaque-extra",
      },
    ]) {
      const harness = createStorageHarness(entries);
      const before = [...harness.values];
      expect(
        createBookingPaymentJournalRepository({
          driver: harness.driver,
          now: () => initialNow,
        }).createQuoted(createNextQuotedInput()),
      ).toEqual({ status: "rejected", reason: "opaque-v2-state" });
      expect([...harness.values]).toEqual(before);
    }
  });

  it("fails closed on enumeration failure and unverifiable expired removal", () => {
    const enumerationHarness = createStorageHarness();
    vi.spyOn(enumerationHarness.driver, "keys").mockReturnValue({
      ok: false,
      error: { kind: "storage-unavailable", operation: "keys" },
    });
    expect(
      createBookingPaymentJournalRepository({
        driver: enumerationHarness.driver,
        now: () => initialNow,
      }).createQuoted(createQuotedInput()),
    ).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "keys" },
    });

    const removalHarness = createStorageHarness();
    let currentTime = initialNow;
    const removalRepository = createBookingPaymentJournalRepository({
      driver: removalHarness.driver,
      now: () => currentTime,
    });
    requireWritten(removalRepository.createQuoted(createQuotedInput()));
    currentTime += 5 * 60_000;
    vi.spyOn(removalHarness.storage, "removeItem").mockImplementation(
      () => undefined,
    );
    expect(removalRepository.createQuoted(createNextQuotedInput())).toEqual({
      status: "rejected",
      reason: "cleanup-not-verified",
    });
    expect(removalHarness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(
      true,
    );
  });

  it("fails closed when post-removal enumeration cannot verify a clean namespace", () => {
    const harness = createStorageHarness();
    let currentTime = initialNow;
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => currentTime,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));
    currentTime += 5 * 60_000;

    const originalKeys = harness.driver.keys.bind(harness.driver);
    vi.spyOn(harness.driver, "keys")
      .mockImplementationOnce(originalKeys)
      .mockReturnValueOnce({
        ok: false,
        error: { kind: "storage-unavailable", operation: "keys" },
      })
      .mockImplementation(originalKeys);
    expect(repository.createQuoted(createNextQuotedInput())).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "keys" },
    });
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
    expect(repository.createQuoted(createNextQuotedInput())).toMatchObject({
      status: "written",
    });
  });

  it("checks liveness immediately before and after expired removal", () => {
    const beforeRemovalHarness = createStorageHarness();
    let currentTime = initialNow;
    const beforeRemovalRepository = createBookingPaymentJournalRepository({
      driver: beforeRemovalHarness.driver,
      now: () => currentTime,
    });
    requireWritten(beforeRemovalRepository.createQuoted(createQuotedInput()));
    currentTime += 5 * 60_000;
    const beforeRemoval = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    expect(
      beforeRemovalRepository.createQuoted(
        createNextQuotedInput(beforeRemoval),
      ),
    ).toEqual({ status: "stale" });
    expect(
      beforeRemovalHarness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY),
    ).toBe(true);

    const afterRemovalHarness = createStorageHarness();
    currentTime = initialNow;
    const afterRemovalRepository = createBookingPaymentJournalRepository({
      driver: afterRemovalHarness.driver,
      now: () => currentTime,
    });
    requireWritten(afterRemovalRepository.createQuoted(createQuotedInput()));
    currentTime += 5 * 60_000;
    const afterRemoval = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    expect(
      afterRemovalRepository.createQuoted(createNextQuotedInput(afterRemoval)),
    ).toEqual({ status: "stale" });
    expect(afterRemovalHarness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(
      false,
    );
    expect(
      afterRemovalRepository.createQuoted(createNextQuotedInput()),
    ).toMatchObject({ status: "written" });
  });

  it("can safely retry a new write after expired cleanup succeeded but set failed", () => {
    const harness = createStorageHarness();
    let currentTime = initialNow;
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => currentTime,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));
    currentTime += 5 * 60_000;

    const originalSet = harness.storage.setItem.bind(harness.storage);
    vi.spyOn(harness.storage, "setItem")
      .mockImplementationOnce(() => {
        throw new Error("transient quota failure with payload");
      })
      .mockImplementation(originalSet);
    expect(repository.createQuoted(createNextQuotedInput())).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "set" },
    });
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
    expect(repository.createQuoted(createNextQuotedInput())).toMatchObject({
      status: "written",
    });
  });

  it("never exposes transaction data without exact lease, flow, locator and live guard", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));

    expect(repository.read(authority())).toMatchObject({ status: "found" });
    expect(repository.read(authority(() => false))).toEqual({
      status: "stale",
    });
    expect(
      repository.read(authority(() => true, { owner: otherOwner })),
    ).toEqual({
      status: "rejected",
      reason: "foreign-owner",
    });
    expect(
      repository.read(authority(() => true, { lease: replacementLease })),
    ).toEqual({ status: "rejected", reason: "stale-lease" });
    expect(
      repository.read(
        authority(() => true, {
          flowId: "80000000-0000-4000-8000-000000000008",
        }),
      ),
    ).toEqual({ status: "rejected", reason: "flow-mismatch" });
    expect(
      repository.read(
        authority(() => true, {
          locator: { kind: "accommodation", accommodationId: 8 },
        }),
      ),
    ).toEqual({ status: "rejected", reason: "locator-mismatch" });
  });

  it("claims a same-owner recovery only with exact route/resource identity", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));

    expect(
      repository.claimRecoveryLease({
        owner,
        flowId,
        locator: { kind: "accommodation", accommodationId: 8 },
        lease: replacementLease,
        isCurrent: () => true,
      }),
    ).toEqual({ status: "rejected", reason: "locator-mismatch" });
    expect(
      repository.claimRecoveryLease({
        owner,
        flowId: nextFlowId,
        locator: accommodationLocator,
        lease: replacementLease,
        isCurrent: () => true,
      }),
    ).toEqual({ status: "rejected", reason: "flow-mismatch" });
    expect(
      repository.claimRecoveryLease({
        owner,
        flowId,
        locator: accommodationLocator,
        lease: replacementLease,
        isCurrent: () => true,
      }),
    ).toMatchObject({ status: "written", record: { lease: replacementLease } });
    expect(repository.read(authority())).toEqual({
      status: "rejected",
      reason: "stale-lease",
    });
    expect(
      repository.read(authority(() => true, { lease: replacementLease })),
    ).toMatchObject({ status: "found" });
  });

  it("checks claim liveness immediately before and after lease replacement", () => {
    const beforeSetHarness = createStorageHarness();
    const beforeSetRepository = createBookingPaymentJournalRepository({
      driver: beforeSetHarness.driver,
      now: () => initialNow,
    });
    requireWritten(beforeSetRepository.createQuoted(createQuotedInput()));
    const beforeSet = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    expect(
      beforeSetRepository.claimRecoveryLease({
        owner,
        flowId,
        locator: accommodationLocator,
        lease: replacementLease,
        isCurrent: beforeSet,
      }),
    ).toEqual({ status: "stale" });
    expect(
      JSON.parse(
        beforeSetHarness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY) ?? "null",
      ).lease,
    ).toEqual(lease);

    const afterReadBackHarness = createStorageHarness();
    const afterReadBackRepository = createBookingPaymentJournalRepository({
      driver: afterReadBackHarness.driver,
      now: () => initialNow,
    });
    requireWritten(afterReadBackRepository.createQuoted(createQuotedInput()));
    const afterReadBack = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    expect(
      afterReadBackRepository.claimRecoveryLease({
        owner,
        flowId,
        locator: accommodationLocator,
        lease: replacementLease,
        isCurrent: afterReadBack,
      }),
    ).toEqual({ status: "stale" });
    expect(
      JSON.parse(
        afterReadBackHarness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY) ??
          "null",
      ).lease,
    ).toEqual(replacementLease);
  });

  it("rejects unsupported paid checkout preparation but preserves its quote for inspection", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    const unsupportedQuote = quote({ discountAmount: 1_901, amount: 99 });
    const record = requireWritten(
      repository.createQuoted(createQuotedInput(() => true, unsupportedQuote)),
    );
    expect(repository.read(authority())).toMatchObject({
      status: "found",
      record: { data: { quote: { amount: 99 } } },
    });
    expect(
      repository.replaceExpectedPhase({
        ...authority(),
        expectedPhase: "quoted",
        nextData: {
          ...record.data,
          phase: "checkout-prepared",
          checkout,
        },
      }),
    ).toEqual({ status: "rejected", reason: "illegal-transition" });
  });

  it("never advances a recovered unsupported hold to attempt-requesting", () => {
    const unsupportedQuote = quote({ discountAmount: 1_901, amount: 99 });
    const unsupportedReady = ready({
      discountAmount: 1_901,
      amount: 99,
    });
    const unsupportedData: BookingPaymentJournalData = {
      phase: "reservation-ready",
      flowId,
      serverIntent: createQuotedInput().serverIntent,
      presentationIntent: createQuotedInput().presentationIntent,
      recoveryExpiresAt: initialNow + 15 * 60_000,
      quote: unsupportedQuote,
      checkout,
      ready: unsupportedReady,
    };
    const record: BookingPaymentJournalEnvelope = {
      purpose: "booking-payment-journal",
      version: 2,
      privacyClass: "sensitive",
      containsPii: false,
      owner,
      createdAt: initialNow,
      hardExpiresAt: initialNow + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
      lease,
      data: unsupportedData,
    };
    const harness = createStorageHarness({
      [BOOKING_PAYMENT_V2_JOURNAL_KEY]: JSON.stringify(record),
    });
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });

    expect(
      repository.replaceExpectedPhase({
        ...authority(() => true, { locator: reservationLocator }),
        expectedPhase: "reservation-ready",
        nextData: { ...unsupportedData, phase: "attempt-requesting" },
      }),
    ).toEqual({ status: "rejected", reason: "illegal-transition" });
    expect(
      repository.replaceExpectedPhase({
        ...authority(() => true, { locator: reservationLocator }),
        expectedPhase: "reservation-ready",
        nextData: { ...unsupportedData, phase: "hold-release-requesting" },
      }),
    ).toMatchObject({ status: "written" });
  });

  it("never fabricates an attempt while releasing a ready-only hold", () => {
    const readyData = reservationReadyData();
    const record = journalEnvelope(readyData);
    const initialRaw = JSON.stringify(record);
    const harness = createStorageHarness({
      [BOOKING_PAYMENT_V2_JOURNAL_KEY]: initialRaw,
    });
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });

    expect(
      repository.replaceExpectedPhase({
        ...authority(() => true, { locator: reservationLocator }),
        expectedPhase: "reservation-ready",
        nextData: {
          ...readyData,
          phase: "hold-release-requesting",
          attempt: attempt(),
        } as BookingPaymentJournalData,
      }),
    ).toEqual({ status: "rejected", reason: "immutable-group-change" });
    expect(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(initialRaw);

    const requesting = repository.replaceExpectedPhase({
      ...authority(() => true, { locator: reservationLocator }),
      expectedPhase: "reservation-ready",
      nextData: {
        ...readyData,
        phase: "hold-release-requesting",
      } as BookingPaymentJournalData,
    });
    if (requesting.status !== "written") {
      throw new Error("Expected ready-only hold release request");
    }
    const requestingRaw = harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY);

    expect(
      repository.replaceExpectedPhase({
        ...authority(() => true, { locator: reservationLocator }),
        expectedPhase: "hold-release-requesting",
        nextData: {
          ...requesting.record.data,
          phase: "hold-released",
          attempt: attempt(),
          release: {
            reservationUid,
            status: "EXPIRED",
            releasedNow: true,
            serverTime: "2026-09-01T10:01:00Z",
          },
        } as BookingPaymentJournalData,
      }),
    ).toEqual({ status: "rejected", reason: "immutable-group-change" });
    expect(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(
      requestingRaw,
    );
  });

  it("enforces explicit adjacency, immutable accumulated groups and flow identity", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    const quoted = requireWritten(repository.createQuoted(createQuotedInput()));
    const preparedData: BookingPaymentJournalData = {
      ...quoted.data,
      phase: "checkout-prepared",
      checkout,
    };

    expect(
      repository.replaceExpectedPhase({
        ...authority(),
        expectedPhase: "quoted",
        nextData: {
          ...preparedData,
          phase: "attempt-ready",
          ready: ready(),
          attempt: attempt(),
        },
      }),
    ).toEqual({ status: "rejected", reason: "illegal-transition" });
    expect(
      repository.replaceExpectedPhase({
        ...authority(),
        expectedPhase: "quoted",
        nextData: { ...preparedData, flowId: replacementLease.runtimeLeaseId },
      }),
    ).toEqual({ status: "rejected", reason: "flow-mismatch" });
    expect(
      repository.replaceExpectedPhase({
        ...authority(),
        expectedPhase: "quoted",
        nextData: preparedData,
      }),
    ).toMatchObject({ status: "written" });
    expect(
      repository.replaceExpectedPhase({
        ...authority(),
        expectedPhase: "checkout-prepared",
        nextData: {
          ...preparedData,
          phase: "checkout-submitting",
          checkout: { ...checkout, idempotencyKey: "different-key-123" },
        },
      }),
    ).toEqual({ status: "rejected", reason: "immutable-group-change" });
  });

  it("treats StrictMode exact duplicates as non-authoritative no-ops without sliding TTL", () => {
    const harness = createStorageHarness();
    const setItem = vi.spyOn(harness.storage, "setItem");
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    const quoted = requireWritten(repository.createQuoted(createQuotedInput()));
    const preparedData: BookingPaymentJournalData = {
      ...quoted.data,
      phase: "checkout-prepared",
      checkout,
    };
    const first = repository.replaceExpectedPhase({
      ...authority(),
      expectedPhase: "quoted",
      nextData: preparedData,
    });
    expect(first).toMatchObject({ status: "written" });
    const rawAfterFirst = harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY);

    expect(
      repository.replaceExpectedPhase({
        ...authority(),
        expectedPhase: "quoted",
        nextData: preparedData,
      }),
    ).toEqual({ status: "unchanged" });
    expect(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(
      rawAfterFirst,
    );
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it("uses hard-cap submitting TTL then server-relative Ready and attempt deadlines", () => {
    const harness = createStorageHarness();
    let currentTime = initialNow;
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => currentTime,
    });
    const quoted = requireWritten(repository.createQuoted(createQuotedInput()));
    const preparedData: BookingPaymentJournalData = {
      ...quoted.data,
      phase: "checkout-prepared",
      checkout,
    };
    const prepared = repository.replaceExpectedPhase({
      ...authority(),
      expectedPhase: "quoted",
      nextData: preparedData,
    });
    expect(prepared).toMatchObject({
      status: "written",
      record: { data: { recoveryExpiresAt: initialNow + 300_000 } },
    });
    const submitting = repository.replaceExpectedPhase({
      ...authority(),
      expectedPhase: "checkout-prepared",
      nextData: { ...preparedData, phase: "checkout-submitting" },
    });
    expect(submitting).toMatchObject({
      status: "written",
      record: {
        data: {
          recoveryExpiresAt: initialNow + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
        },
      },
    });
    if (submitting.status !== "written") throw new Error("Expected submitting");

    currentTime += 60_000;
    const reservationReady = repository.replaceExpectedPhase({
      ...authority(),
      expectedPhase: "checkout-submitting",
      nextData: {
        ...submitting.record.data,
        phase: "reservation-ready",
        ready: ready(),
      } as BookingPaymentJournalData,
    });
    expect(reservationReady).toMatchObject({
      status: "written",
      record: { data: { recoveryExpiresAt: initialNow + 16 * 60_000 } },
    });
    if (reservationReady.status !== "written")
      throw new Error("Expected Ready");

    const attemptRequesting = repository.replaceExpectedPhase({
      ...authority(() => true, { locator: reservationLocator }),
      expectedPhase: "reservation-ready",
      nextData: {
        ...reservationReady.record.data,
        phase: "attempt-requesting",
      } as BookingPaymentJournalData,
    });
    expect(attemptRequesting).toMatchObject({ status: "written" });
    if (attemptRequesting.status !== "written")
      throw new Error("Expected attempt request");

    currentTime += 60_000;
    expect(
      repository.replaceExpectedPhase({
        ...authority(() => true, { locator: reservationLocator }),
        expectedPhase: "attempt-requesting",
        nextData: {
          ...attemptRequesting.record.data,
          phase: "attempt-ready",
          attempt: attempt({
            remainingSeconds: 600,
            serverTime: "2026-09-01T10:05:00Z",
          }),
        } as BookingPaymentJournalData,
      }),
    ).toMatchObject({
      status: "written",
      record: { data: { recoveryExpiresAt: initialNow + 12 * 60_000 } },
    });
  });

  it("fails closed when a transition becomes stale before or after its set/read-back", () => {
    const beforeSetHarness = createStorageHarness();
    const beforeSetRepository = createBookingPaymentJournalRepository({
      driver: beforeSetHarness.driver,
      now: () => initialNow,
    });
    const quoted = requireWritten(
      beforeSetRepository.createQuoted(createQuotedInput()),
    );
    const nextData: BookingPaymentJournalData = {
      ...quoted.data,
      phase: "checkout-prepared",
      checkout,
    };
    const beforeSet = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    expect(
      beforeSetRepository.replaceExpectedPhase({
        ...authority(beforeSet),
        expectedPhase: "quoted",
        nextData,
      }),
    ).toEqual({ status: "stale" });
    expect(
      JSON.parse(
        beforeSetHarness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY) ?? "null",
      ).data.phase,
    ).toBe("quoted");

    const afterSetHarness = createStorageHarness();
    const afterSetRepository = createBookingPaymentJournalRepository({
      driver: afterSetHarness.driver,
      now: () => initialNow,
    });
    const afterQuoted = requireWritten(
      afterSetRepository.createQuoted(createQuotedInput()),
    );
    const afterSet = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    expect(
      afterSetRepository.replaceExpectedPhase({
        ...authority(afterSet),
        expectedPhase: "quoted",
        nextData: {
          ...afterQuoted.data,
          phase: "checkout-prepared",
          checkout,
        },
      }),
    ).toEqual({ status: "stale" });
    expect(
      JSON.parse(
        afterSetHarness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY) ?? "null",
      ).data.phase,
    ).toBe("checkout-prepared");
  });

  it("reconciles only a sole known journal and never exposes candidate data", () => {
    const sameOwnerHarness = createStorageHarness();
    const sameOwnerRepository = createBookingPaymentJournalRepository({
      driver: sameOwnerHarness.driver,
      now: () => initialNow,
    });
    requireWritten(sameOwnerRepository.createQuoted(createQuotedInput()));
    expect(sameOwnerRepository.reconcileCandidateOwner(owner)).toEqual({
      status: "recovery-required",
    });

    expect(sameOwnerRepository.reconcileCandidateOwner(otherOwner)).toEqual({
      status: "ready",
    });
    expect(sameOwnerHarness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(
      false,
    );

    const unknownHarness = createStorageHarness({
      "airbob:booking-payment-v2:future": "opaque",
    });
    const unknownRepository = createBookingPaymentJournalRepository({
      driver: unknownHarness.driver,
      now: () => initialNow,
    });
    expect(unknownRepository.reconcileCandidateOwner(owner)).toEqual({
      status: "blocked",
      reason: "unknown-v2-state",
    });
    expect(unknownHarness.values.size).toBe(1);
  });

  it("verified-purges a valid same-owner journal that expired before candidate publication", () => {
    const harness = createStorageHarness();
    let currentNow = initialNow;
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => currentNow,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));

    currentNow = initialNow + 5 * 60_000;

    expect(repository.reconcileCandidateOwner(owner)).toEqual({
      status: "ready",
    });
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
  });

  it("blocks candidate publication on journal read or namespace enumeration failure", () => {
    const readHarness = createStorageHarness();
    const readRepository = createBookingPaymentJournalRepository({
      driver: readHarness.driver,
      now: () => initialNow,
    });
    requireWritten(readRepository.createQuoted(createQuotedInput()));
    vi.spyOn(readHarness.driver, "getItem").mockReturnValue({
      ok: false,
      error: { kind: "storage-unavailable", operation: "get" },
    });
    expect(readRepository.reconcileCandidateOwner(owner)).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "get" },
    });
    expect(readHarness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(true);

    const enumerationHarness = createStorageHarness();
    const enumerationRepository = createBookingPaymentJournalRepository({
      driver: enumerationHarness.driver,
      now: () => initialNow,
    });
    requireWritten(enumerationRepository.createQuoted(createQuotedInput()));
    vi.spyOn(enumerationHarness.driver, "keys").mockReturnValue({
      ok: false,
      error: { kind: "storage-unavailable", operation: "keys" },
    });
    expect(enumerationRepository.reconcileCandidateOwner(owner)).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "keys" },
    });
    expect(enumerationHarness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(
      true,
    );
  });

  it("blocks candidate publication when post-removal enumeration fails", () => {
    const harness = createStorageHarness();
    let currentNow = initialNow;
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => currentNow,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));
    currentNow = initialNow + 5 * 60_000;
    vi.spyOn(harness.driver, "keys")
      .mockReturnValueOnce({
        ok: true,
        value: [BOOKING_PAYMENT_V2_JOURNAL_KEY],
      })
      .mockReturnValueOnce({
        ok: false,
        error: { kind: "storage-unavailable", operation: "keys" },
      });

    expect(repository.reconcileCandidateOwner(owner)).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "keys" },
    });
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
  });

  it("purges exact-v2 malformed state but preserves malformed/unknown and newer versions", () => {
    const exactV2Harness = createStorageHarness({
      [BOOKING_PAYMENT_V2_JOURNAL_KEY]: JSON.stringify({ version: 2 }),
    });
    expect(
      createBookingPaymentJournalRepository({
        driver: exactV2Harness.driver,
        now: () => initialNow,
      }).reconcileCandidateOwner(owner),
    ).toEqual({ status: "ready" });
    expect(exactV2Harness.values.size).toBe(0);

    for (const raw of ["not-json", JSON.stringify({ version: 3 })]) {
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: raw,
      });
      const result = createBookingPaymentJournalRepository({
        driver: harness.driver,
        now: () => initialNow,
      }).reconcileCandidateOwner(owner);
      expect(result).toMatchObject({ status: "blocked" });
      expect(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(raw);
    }
  });

  it("fails candidate publication when exact-v2 cleanup cannot be verified", () => {
    const harness = createStorageHarness({
      [BOOKING_PAYMENT_V2_JOURNAL_KEY]: JSON.stringify({ version: 2 }),
    });
    vi.spyOn(harness.storage, "removeItem").mockImplementation(() => undefined);
    expect(
      createBookingPaymentJournalRepository({
        driver: harness.driver,
        now: () => initialNow,
      }).reconcileCandidateOwner(owner),
    ).toEqual({ status: "blocked", reason: "cleanup-not-verified" });
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(true);
  });

  it("acknowledges only an exact leased terminal and verifies removal", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    const complimentaryQuote = quote({
      nightlyPrice: 0,
      subtotal: 0,
      discountAmount: 0,
      amount: 0,
      paymentRequired: false,
    });
    const quoted = requireWritten(
      repository.createQuoted(
        createQuotedInput(() => true, complimentaryQuote),
      ),
    );
    const preparedData: BookingPaymentJournalData = {
      ...quoted.data,
      phase: "checkout-prepared",
      checkout,
    };
    const prepared = repository.replaceExpectedPhase({
      ...authority(),
      expectedPhase: "quoted",
      nextData: preparedData,
    });
    if (prepared.status !== "written") throw new Error("Expected prepared");
    const submitting = repository.replaceExpectedPhase({
      ...authority(),
      expectedPhase: "checkout-prepared",
      nextData: {
        ...prepared.record.data,
        phase: "checkout-submitting",
      } as BookingPaymentJournalData,
    });
    if (submitting.status !== "written") throw new Error("Expected submitting");
    const terminal = repository.replaceExpectedPhase({
      ...authority(),
      expectedPhase: "checkout-submitting",
      nextData: {
        ...submitting.record.data,
        phase: "complimentary-observed",
        ready: ready({
          subtotal: 0,
          discountAmount: 0,
          amount: 0,
          paymentRequired: false,
          paymentAllowed: false,
          status: "CONFIRMED",
          holdExpiresAt: null,
        }),
      } as BookingPaymentJournalData,
    });
    expect(terminal).toMatchObject({ status: "written" });

    expect(
      repository.acknowledgeTerminal({
        ...authority(() => true, { locator: reservationLocator }),
        expectedPhase: "complimentary-observed",
      }),
    ).toEqual({ status: "cleared" });
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
  });

  it("preserves raw state when terminal acknowledgment authority or removal is unverified", () => {
    const nonterminalData = reservationReadyData();
    const nonterminalRaw = JSON.stringify(journalEnvelope(nonterminalData));
    const authorityCases = [
      {
        input: {
          ...authority(() => true, { locator: reservationLocator }),
          expectedPhase: "reservation-ready" as const,
        },
        expected: { status: "rejected", reason: "not-terminal" },
      },
      {
        input: {
          ...authority(() => true, { locator: reservationLocator }),
          expectedPhase: "hold-released" as const,
        },
        expected: { status: "rejected", reason: "phase-mismatch" },
      },
      {
        input: {
          ...authority(() => true, {
            lease: replacementLease,
            locator: reservationLocator,
          }),
          expectedPhase: "reservation-ready" as const,
        },
        expected: { status: "rejected", reason: "stale-lease" },
      },
      {
        input: {
          ...authority(() => true, {
            flowId: nextFlowId,
            locator: reservationLocator,
          }),
          expectedPhase: "reservation-ready" as const,
        },
        expected: { status: "rejected", reason: "flow-mismatch" },
      },
      {
        input: {
          ...authority(() => true, { locator: accommodationLocator }),
          expectedPhase: "reservation-ready" as const,
        },
        expected: { status: "rejected", reason: "locator-mismatch" },
      },
    ] as const;

    authorityCases.forEach(({ input, expected }) => {
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: nonterminalRaw,
      });
      const repository = createBookingPaymentJournalRepository({
        driver: harness.driver,
        now: () => initialNow,
      });
      expect(repository.acknowledgeTerminal(input)).toEqual(expected);
      expect(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(
        nonterminalRaw,
      );
    });

    const terminalData: BookingPaymentJournalData = {
      ...nonterminalData,
      phase: "reservation-status-observed",
      ready: ready({
        status: "PAYMENT_PROCESSING",
        paymentAllowed: false,
        holdExpiresAt: null,
      }),
    };
    const terminalRaw = JSON.stringify(journalEnvelope(terminalData));

    const failedRemovalHarness = createStorageHarness({
      [BOOKING_PAYMENT_V2_JOURNAL_KEY]: terminalRaw,
    });
    vi.spyOn(failedRemovalHarness.driver, "removeItem").mockReturnValue({
      ok: false,
      error: { kind: "storage-unavailable", operation: "remove" },
    });
    expect(
      createBookingPaymentJournalRepository({
        driver: failedRemovalHarness.driver,
        now: () => initialNow,
      }).acknowledgeTerminal({
        ...authority(() => true, { locator: reservationLocator }),
        expectedPhase: "reservation-status-observed",
      }),
    ).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "remove" },
    });
    expect(
      failedRemovalHarness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY),
    ).toBe(terminalRaw);

    const noOpRemovalHarness = createStorageHarness({
      [BOOKING_PAYMENT_V2_JOURNAL_KEY]: terminalRaw,
    });
    vi.spyOn(noOpRemovalHarness.storage, "removeItem").mockImplementation(
      () => undefined,
    );
    expect(
      createBookingPaymentJournalRepository({
        driver: noOpRemovalHarness.driver,
        now: () => initialNow,
      }).acknowledgeTerminal({
        ...authority(() => true, { locator: reservationLocator }),
        expectedPhase: "reservation-status-observed",
      }),
    ).toEqual({ status: "rejected", reason: "remove-not-verified" });
    expect(noOpRemovalHarness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(
      terminalRaw,
    );
  });

  it("acknowledges reservation-status and hold-release terminal families", () => {
    const readyData = reservationReadyData();
    const terminalData = [
      {
        ...readyData,
        phase: "reservation-status-observed",
        ready: ready({
          status: "PAYMENT_PROCESSING",
          paymentAllowed: false,
          holdExpiresAt: null,
        }),
      },
      {
        ...readyData,
        phase: "hold-released",
        release: {
          reservationUid,
          status: "EXPIRED",
          releasedNow: true,
          serverTime: "2026-09-01T10:01:00Z",
        },
      },
    ] as const satisfies readonly BookingPaymentJournalData[];

    terminalData.forEach((data) => {
      const harness = createStorageHarness({
        [BOOKING_PAYMENT_V2_JOURNAL_KEY]: JSON.stringify(journalEnvelope(data)),
      });
      expect(
        createBookingPaymentJournalRepository({
          driver: harness.driver,
          now: () => initialNow,
        }).acknowledgeTerminal({
          ...authority(() => true, { locator: reservationLocator }),
          expectedPhase: data.phase,
        }),
      ).toEqual({ status: "cleared" });
      expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
    });
  });

  it("does not clear a terminal after the live authority becomes stale", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    const complimentaryQuote = quote({
      nightlyPrice: 0,
      subtotal: 0,
      discountAmount: 0,
      amount: 0,
      paymentRequired: false,
    });
    const quoted = requireWritten(
      repository.createQuoted(
        createQuotedInput(() => true, complimentaryQuote),
      ),
    );
    const prepared = repository.replaceExpectedPhase({
      ...authority(),
      expectedPhase: "quoted",
      nextData: {
        ...quoted.data,
        phase: "checkout-prepared",
        checkout,
      } as BookingPaymentJournalData,
    });
    if (prepared.status !== "written") throw new Error("Expected prepared");
    const submitting = repository.replaceExpectedPhase({
      ...authority(),
      expectedPhase: "checkout-prepared",
      nextData: {
        ...prepared.record.data,
        phase: "checkout-submitting",
      } as BookingPaymentJournalData,
    });
    if (submitting.status !== "written") throw new Error("Expected submitting");
    const terminal = repository.replaceExpectedPhase({
      ...authority(),
      expectedPhase: "checkout-submitting",
      nextData: {
        ...submitting.record.data,
        phase: "complimentary-observed",
        ready: ready({
          subtotal: 0,
          discountAmount: 0,
          amount: 0,
          paymentRequired: false,
          paymentAllowed: false,
          status: "CONFIRMED",
          holdExpiresAt: null,
        }),
      } as BookingPaymentJournalData,
    });
    if (terminal.status !== "written") throw new Error("Expected terminal");

    const becomesStale = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    expect(
      repository.acknowledgeTerminal({
        ...authority(becomesStale, { locator: reservationLocator }),
        expectedPhase: "complimentary-observed",
      }),
    ).toEqual({ status: "stale" });
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(true);
  });

  it("closes exact quoted and unsent checkout-prepared flows on local abandon", () => {
    for (const targetPhase of ["quoted", "checkout-prepared"] as const) {
      const harness = createStorageHarness();
      const repository = createBookingPaymentJournalRepository({
        driver: harness.driver,
        now: () => initialNow,
      });
      const quoted = requireWritten(
        repository.createQuoted(createQuotedInput()),
      );
      if (targetPhase === "checkout-prepared") {
        const prepared = repository.replaceExpectedPhase({
          ...authority(),
          expectedPhase: "quoted",
          nextData: {
            ...quoted.data,
            phase: "checkout-prepared",
            checkout,
          } as BookingPaymentJournalData,
        });
        if (prepared.status !== "written") {
          throw new Error("Expected checkout-prepared journal");
        }
      }

      expect(
        repository.closeUnheldFlow({
          ...authority(),
          closeReason: { type: "quote-abandoned" },
        }),
      ).toEqual({ status: "cleared" });
      expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
    }
  });

  it.each(["R017", "R018", "R019"] as const)(
    "closes checkout-submitting after definitive backend rejection %s",
    (code) => {
      const harness = createStorageHarness();
      const repository = createBookingPaymentJournalRepository({
        driver: harness.driver,
        now: () => initialNow,
      });
      const quoted = requireWritten(
        repository.createQuoted(createQuotedInput()),
      );
      const prepared = repository.replaceExpectedPhase({
        ...authority(),
        expectedPhase: "quoted",
        nextData: {
          ...quoted.data,
          phase: "checkout-prepared",
          checkout,
        } as BookingPaymentJournalData,
      });
      if (prepared.status !== "written") throw new Error("Expected prepared");
      const submitting = repository.replaceExpectedPhase({
        ...authority(),
        expectedPhase: "checkout-prepared",
        nextData: {
          ...prepared.record.data,
          phase: "checkout-submitting",
        } as BookingPaymentJournalData,
      });
      expect(submitting).toMatchObject({ status: "written" });

      expect(
        repository.closeUnheldFlow({
          ...authority(),
          closeReason: { type: "checkout-definitively-rejected", code },
        }),
      ).toEqual({ status: "cleared" });
    },
  );

  it("rejects close reasons outside their exact phase and allowlist", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));

    expect(
      repository.closeUnheldFlow({
        ...authority(),
        closeReason: {
          type: "checkout-definitively-rejected",
          code: "R017",
        },
      }),
    ).toEqual({ status: "rejected", reason: "phase-mismatch" });
    expect(
      repository.closeUnheldFlow({
        ...authority(),
        closeReason: {
          type: "checkout-definitively-rejected",
          code: "R016",
        } as never,
      }),
    ).toEqual({ status: "rejected", reason: "invalid-close-reason" });
    expect(
      repository.closeUnheldFlow({
        ...authority(),
        closeReason: {
          type: "checkout-definitively-rejected",
          code: "R020",
        } as never,
      }),
    ).toEqual({ status: "rejected", reason: "invalid-close-reason" });
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(true);
  });

  it("requires exact flow, lease and accommodation locator to close", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));
    const closeReason = { type: "quote-abandoned" as const };

    expect(
      repository.closeUnheldFlow({
        ...authority(() => true, { flowId: nextFlowId }),
        closeReason,
      }),
    ).toEqual({ status: "rejected", reason: "flow-mismatch" });
    expect(
      repository.closeUnheldFlow({
        ...authority(() => true, { lease: replacementLease }),
        closeReason,
      }),
    ).toEqual({ status: "rejected", reason: "stale-lease" });
    expect(
      repository.closeUnheldFlow({
        ...authority(() => true, {
          locator: { kind: "accommodation", accommodationId: 8 },
        }),
        closeReason,
      }),
    ).toEqual({ status: "rejected", reason: "locator-mismatch" });
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(true);
  });

  it("preserves the whole flow when any extra v2 slot appears before close", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));
    harness.values.set(
      "airbob:booking-payment-v2:operation-receipt",
      "opaque-receipt",
    );

    expect(
      repository.closeUnheldFlow({
        ...authority(),
        closeReason: { type: "quote-abandoned" },
      }),
    ).toEqual({ status: "rejected", reason: "opaque-v2-state" });
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(true);
    expect(
      harness.values.get("airbob:booking-payment-v2:operation-receipt"),
    ).toBe("opaque-receipt");
  });

  it("fails closed on no-op/failing removal and stale close boundaries", () => {
    const noOpHarness = createStorageHarness();
    const noOpRepository = createBookingPaymentJournalRepository({
      driver: noOpHarness.driver,
      now: () => initialNow,
    });
    requireWritten(noOpRepository.createQuoted(createQuotedInput()));
    vi.spyOn(noOpHarness.storage, "removeItem").mockImplementation(
      () => undefined,
    );
    expect(
      noOpRepository.closeUnheldFlow({
        ...authority(),
        closeReason: { type: "quote-abandoned" },
      }),
    ).toEqual({ status: "rejected", reason: "remove-not-verified" });

    const failingHarness = createStorageHarness();
    const failingRepository = createBookingPaymentJournalRepository({
      driver: failingHarness.driver,
      now: () => initialNow,
    });
    requireWritten(failingRepository.createQuoted(createQuotedInput()));
    vi.spyOn(failingHarness.storage, "removeItem").mockImplementation(() => {
      throw new Error("remove failed with payload");
    });
    expect(
      failingRepository.closeUnheldFlow({
        ...authority(),
        closeReason: { type: "quote-abandoned" },
      }),
    ).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "remove" },
    });

    const beforeHarness = createStorageHarness();
    const beforeRepository = createBookingPaymentJournalRepository({
      driver: beforeHarness.driver,
      now: () => initialNow,
    });
    requireWritten(beforeRepository.createQuoted(createQuotedInput()));
    const staleBeforeRemove = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    expect(
      beforeRepository.closeUnheldFlow({
        ...authority(staleBeforeRemove),
        closeReason: { type: "quote-abandoned" },
      }),
    ).toEqual({ status: "stale" });
    expect(beforeHarness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(true);

    const afterHarness = createStorageHarness();
    const afterRepository = createBookingPaymentJournalRepository({
      driver: afterHarness.driver,
      now: () => initialNow,
    });
    requireWritten(afterRepository.createQuoted(createQuotedInput()));
    const staleAfterRemove = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    expect(
      afterRepository.closeUnheldFlow({
        ...authority(staleAfterRemove),
        closeReason: { type: "quote-abandoned" },
      }),
    ).toEqual({ status: "stale" });
    expect(afterHarness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
  });

  it("fails closed when close removal cannot be verified by final enumeration", () => {
    const harness = createStorageHarness();
    const repository = createBookingPaymentJournalRepository({
      driver: harness.driver,
      now: () => initialNow,
    });
    requireWritten(repository.createQuoted(createQuotedInput()));
    vi.spyOn(harness.driver, "keys")
      .mockReturnValueOnce({
        ok: true,
        value: [BOOKING_PAYMENT_V2_JOURNAL_KEY],
      })
      .mockReturnValueOnce({
        ok: true,
        value: [BOOKING_PAYMENT_V2_JOURNAL_KEY],
      })
      .mockReturnValueOnce({
        ok: false,
        error: { kind: "storage-unavailable", operation: "keys" },
      });

    expect(
      repository.closeUnheldFlow({
        ...authority(),
        closeReason: { type: "quote-abandoned" },
      }),
    ).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "keys" },
    });
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
  });
});
