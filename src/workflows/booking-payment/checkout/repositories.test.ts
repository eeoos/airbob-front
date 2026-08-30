import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import { createSessionStorageDriver } from "../../../platform/storage/sessionStorageDriver";
import {
  clearBookingPaymentBrowserState,
  createBookingPaymentCallbackRepository,
  createBookingPaymentCheckoutRepository,
} from "./repositories";
import type {
  BookingPaymentOperationId,
  CallbackData,
  CheckoutHandoffState,
  CheckoutWriteData,
} from "./types";

const scopeA = {
  subject: "subject:viewer_a" as SessionSubject,
  epoch: 7,
} satisfies AuthenticatedSessionScope;
const scopeB = {
  subject: "subject:viewer_b" as SessionSubject,
  epoch: 7,
} satisfies AuthenticatedSessionScope;

const checkout: CheckoutWriteData = {
  accommodationId: 7,
  reservationUid: "reservation-7",
  orderName: "합정 숙소 2박",
  amount: 120_000,
  checkIn: "2026-07-10",
  checkOut: "2026-07-12",
  adultOccupancy: 2,
  childOccupancy: 1,
  infantOccupancy: 0,
  petOccupancy: 0,
  couponName: "여름 할인",
  couponDiscount: 10_000,
};

const legacyCheckout = {
  reservationUid: checkout.reservationUid,
  orderName: checkout.orderName,
  amount: checkout.amount,
  customerEmail: "must-not-persist@example.invalid",
  customerName: "저장하면 안 되는 이름",
  checkIn: checkout.checkIn,
  checkOut: checkout.checkOut,
  adultOccupancy: checkout.adultOccupancy,
  childOccupancy: checkout.childOccupancy,
  infantOccupancy: checkout.infantOccupancy,
  petOccupancy: checkout.petOccupancy,
  couponName: checkout.couponName,
  couponDiscount: checkout.couponDiscount,
};

const createStorage = (entries: Record<string, string> = {}): Storage => {
  const values = new Map(Object.entries(entries));

  return {
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
};

const setup = ({
  storage = createStorage(),
  operationIds = ["operation_1"],
}: {
  storage?: Storage;
  operationIds?: string[];
} = {}) => {
  let now = 1_000;
  let epoch = 7;
  let current = true;
  let operationIndex = 0;
  const driver = createSessionStorageDriver({ getStorage: () => storage });
  const dependencies = {
    driver,
    now: () => now,
    getEpoch: () => epoch,
    createOperationId: () =>
      operationIds[Math.min(operationIndex++, operationIds.length - 1)],
  };

  return {
    storage,
    driver,
    checkoutRepository: createBookingPaymentCheckoutRepository(dependencies),
    callbackRepository: createBookingPaymentCallbackRepository(dependencies),
    isCurrent: () => current,
    setCurrent: (value: boolean) => {
      current = value;
    },
    setEpoch: (value: number) => {
      epoch = value;
    },
    setNow: (value: number) => {
      now = value;
    },
  };
};

const writeCheckout = (harness: ReturnType<typeof setup>) =>
  harness.checkoutRepository.write({
    scope: scopeA,
    data: checkout,
    isCurrent: harness.isCurrent,
  });

const callbackFor = (operationId: BookingPaymentOperationId): CallbackData => ({
  operationId,
  reservationUid: checkout.reservationUid,
  orderId: checkout.reservationUid,
  paymentKey: "payment_key_7",
  amount: checkout.amount,
  phase: "received",
});

const checkoutKey = "airbob:booking-payment-v1:checkout";
const callbackKey = "airbob:booking-payment-v1:callback";
const legacyPrimaryKey = "airbob:reservation-checkout:7";
const legacyIndexKey = "airbob:reservation-checkout-index:reservation-7";

describe("booking-payment checkout repository", () => {
  it("writes the exact subject-owned allowlisted envelope and handoff", () => {
    const harness = setup();

    const result = writeCheckout(harness);
    expect(result).toEqual({
      status: "written",
      data: { operationId: "operation_1", ...checkout },
      handle: {
        checkoutHandoff: {
          purpose: "reservation-checkout",
          version: 1,
          operationId: "operation_1",
        },
      },
    });

    const envelope = JSON.parse(harness.storage.getItem(checkoutKey) ?? "{}");
    expect(envelope).toEqual({
      purpose: "reservation-checkout",
      version: 1,
      privacyClass: "personal",
      containsPii: false,
      owner: scopeA.subject,
      createdAt: 1_000,
      expiresAt: 3_601_000,
      data: { operationId: "operation_1", ...checkout },
    });
    expect(Object.keys(envelope.data).sort()).toEqual(
      ["operationId", ...Object.keys(checkout)].sort(),
    );
    expect(JSON.stringify(envelope)).not.toContain("customerEmail");
    expect(JSON.stringify(envelope)).not.toContain("customerName");
    expect(checkoutKey).not.toContain(scopeA.subject);
    expect(checkoutKey).not.toContain(checkout.reservationUid);
  });

  it.each([
    ["zero amount", { amount: 0 }],
    ["unsafe amount", { amount: Number.MAX_SAFE_INTEGER + 1 }],
    ["invalid date", { checkIn: "2026-02-30" }],
    ["non-increasing dates", { checkOut: checkout.checkIn }],
    ["negative occupancy", { petOccupancy: -1 }],
    ["no paying guests", { adultOccupancy: 0, childOccupancy: 0 }],
    ["unsafe discount", { couponDiscount: Number.MAX_SAFE_INTEGER + 1 }],
    ["blank reservation", { reservationUid: "" }],
  ])("rejects %s", (_name, override) => {
    const harness = setup();

    expect(
      harness.checkoutRepository.write({
        scope: scopeA,
        data: { ...checkout, ...override } as CheckoutWriteData,
        isCurrent: harness.isCurrent,
      }),
    ).toEqual({ status: "rejected", reason: "invalid-data" });
    expect(harness.storage.getItem(checkoutKey)).toBeNull();
  });

  it("purges malformed envelope JSON", () => {
    const harness = setup();
    harness.storage.setItem(checkoutKey, "{");

    expect(
      harness.checkoutRepository.read({
        scope: scopeA,
        accommodationId: 7,
        locationState: null,
      }),
    ).toEqual({ status: "rejected", reason: "malformed" });
    expect(harness.storage.getItem(checkoutKey)).toBeNull();
  });

  it("allows a discount larger than the post-discount payable amount", () => {
    const harness = setup();

    expect(
      harness.checkoutRepository.write({
        scope: scopeA,
        data: { ...checkout, amount: 50, couponDiscount: 150 },
        isCurrent: harness.isCurrent,
      }),
    ).toEqual(expect.objectContaining({ status: "written" }));
  });

  it("rejects unknown checkout fields instead of serializing them", () => {
    const harness = setup();
    const data = {
      ...checkout,
      customerEmail: "must-not-persist@example.invalid",
    } as CheckoutWriteData;

    expect(
      harness.checkoutRepository.write({
        scope: scopeA,
        data,
        isCurrent: harness.isCurrent,
      }),
    ).toEqual({ status: "rejected", reason: "invalid-data" });
  });

  it("returns stale before a write when either epoch or caller lease changed", () => {
    const harness = setup();
    harness.setCurrent(false);
    expect(writeCheckout(harness)).toEqual({ status: "stale" });

    harness.setCurrent(true);
    harness.setEpoch(8);
    expect(writeCheckout(harness)).toEqual({ status: "stale" });
    expect(harness.storage.getItem(checkoutKey)).toBeNull();
  });

  it("supports exact handoff priority and a null reload fallback", () => {
    const harness = setup();
    const written = writeCheckout(harness);
    expect(written.status).toBe("written");
    if (written.status !== "written") throw new Error("fixture failed");

    expect(
      harness.checkoutRepository.read({
        scope: scopeA,
        accommodationId: 7,
        locationState: written.handle,
      }),
    ).toEqual({ status: "found", data: written.data });
    expect(
      harness.checkoutRepository.read({
        scope: scopeA,
        accommodationId: 7,
        locationState: null,
      }),
    ).toEqual({ status: "found", data: written.data });

    const wrongHandle: CheckoutHandoffState = {
      checkoutHandoff: {
        purpose: "reservation-checkout",
        version: 1,
        operationId: "operation_other" as BookingPaymentOperationId,
      },
    };
    expect(
      harness.checkoutRepository.read({
        scope: scopeA,
        accommodationId: 7,
        locationState: wrongHandle,
      }),
    ).toEqual({ status: "rejected", reason: "operation-mismatch" });
    expect(
      harness.checkoutRepository.read({
        scope: scopeA,
        accommodationId: 8,
        locationState: written.handle,
      }),
    ).toEqual({ status: "rejected", reason: "accommodation-mismatch" });
  });

  it("fails closed on malformed history without consuming valid storage", () => {
    const harness = setup();
    writeCheckout(harness);

    expect(
      harness.checkoutRepository.read({
        scope: scopeA,
        accommodationId: 7,
        locationState: {
          checkoutHandoff: {
            purpose: "reservation-checkout",
            version: 1,
            operationId: "operation_1",
            extra: true,
          },
        },
      }),
    ).toEqual({ status: "rejected", reason: "invalid-handoff" });
    expect(harness.storage.getItem(checkoutKey)).not.toBeNull();
  });

  it("reads the static owned checkout for an exact callback reservation UID", () => {
    const harness = setup();
    const written = writeCheckout(harness);
    if (written.status !== "written") throw new Error("fixture failed");

    expect(
      harness.checkoutRepository.readForCallback({
        scope: scopeA,
        reservationUid: checkout.reservationUid,
      }),
    ).toEqual({ status: "found", data: written.data });
    expect(
      harness.checkoutRepository.readForCallback({
        scope: scopeA,
        reservationUid: "reservation-other",
      }),
    ).toEqual({ status: "rejected", reason: "reservation-mismatch" });
    expect(harness.storage.getItem(checkoutKey)).not.toBeNull();
  });

  it.each([
    ["unknown-fields", (record: Record<string, unknown>) => ({ ...record, extra: 1 })],
    ["wrong-version", (record: Record<string, unknown>) => ({ ...record, version: 2 })],
    ["wrong-purpose", (record: Record<string, unknown>) => ({ ...record, purpose: "other" })],
    ["invalid-data", (record: Record<string, unknown>) => ({
      ...record,
      data: { ...(record.data as object), amount: 0 },
    })],
  ])("purges a %s envelope", (reason, mutate) => {
    const harness = setup();
    writeCheckout(harness);
    const envelope = JSON.parse(harness.storage.getItem(checkoutKey) ?? "{}");
    harness.storage.setItem(checkoutKey, JSON.stringify(mutate(envelope)));

    expect(
      harness.checkoutRepository.read({
        scope: scopeA,
        accommodationId: 7,
        locationState: null,
      }),
    ).toEqual({ status: "rejected", reason });
    expect(harness.storage.getItem(checkoutKey)).toBeNull();
  });

  it("purges expired and foreign-owner records so A cannot leak into B", () => {
    const expired = setup();
    writeCheckout(expired);
    expired.setNow(3_601_000);
    expect(
      expired.checkoutRepository.read({
        scope: scopeA,
        accommodationId: 7,
        locationState: null,
      }),
    ).toEqual({ status: "rejected", reason: "expired" });
    expect(expired.storage.getItem(checkoutKey)).toBeNull();

    const foreign = setup();
    writeCheckout(foreign);
    expect(
      foreign.checkoutRepository.read({
        scope: scopeB,
        accommodationId: 7,
        locationState: null,
      }),
    ).toEqual({ status: "rejected", reason: "foreign-owner" });
    expect(foreign.storage.getItem(checkoutKey)).toBeNull();
  });

  it("a stale epoch read cannot inspect or purge the next session checkout", () => {
    const harness = setup();
    writeCheckout(harness);
    const nextSessionEnvelope = JSON.parse(
      harness.storage.getItem(checkoutKey) ?? "{}",
    );
    nextSessionEnvelope.owner = scopeB.subject;
    harness.storage.setItem(checkoutKey, JSON.stringify(nextSessionEnvelope));
    harness.setEpoch(8);

    expect(
      harness.checkoutRepository.read({
        scope: scopeA,
        accommodationId: 7,
        locationState: null,
      }),
    ).toEqual({ status: "rejected", reason: "stale-session" });
    expect(
      harness.checkoutRepository.readForCallback({
        scope: scopeA,
        reservationUid: checkout.reservationUid,
      }),
    ).toEqual({ status: "rejected", reason: "stale-session" });
    expect(harness.storage.getItem(checkoutKey)).not.toBeNull();
  });
});

describe("booking-payment callback repository", () => {
  it("writes an exact sensitive 15-minute callback envelope", () => {
    const harness = setup();
    const checkoutResult = writeCheckout(harness);
    if (checkoutResult.status !== "written") throw new Error("fixture failed");
    const data = callbackFor(checkoutResult.data.operationId);

    expect(
      harness.callbackRepository.write({
        scope: scopeA,
        data,
        isCurrent: harness.isCurrent,
      }),
    ).toEqual({ status: "written", data });
    expect(JSON.parse(harness.storage.getItem(callbackKey) ?? "{}")).toEqual({
      purpose: "payment-callback",
      version: 1,
      privacyClass: "sensitive",
      containsPii: false,
      owner: scopeA.subject,
      createdAt: 1_000,
      expiresAt: 901_000,
      data,
    });
  });

  it.each([
    ["unknown phase", { phase: "confirmed" }],
    ["mismatched order", { orderId: "other-reservation" }],
    ["blank payment key", { paymentKey: "" }],
    ["unsafe amount", { amount: Number.MAX_SAFE_INTEGER + 1 }],
    ["extra field", { extra: true }],
  ])("rejects callback %s", (_name, override) => {
    const harness = setup();
    const data = {
      ...callbackFor("operation_1" as BookingPaymentOperationId),
      ...override,
    } as CallbackData;

    expect(
      harness.callbackRepository.write({
        scope: scopeA,
        data,
        isCurrent: harness.isCurrent,
      }),
    ).toEqual({ status: "rejected", reason: "invalid-data" });
  });

  it("rejects an operation mismatch while preserving the active callback", () => {
    const harness = setup();
    const checkoutResult = writeCheckout(harness);
    if (checkoutResult.status !== "written") throw new Error("fixture failed");
    const data = callbackFor(checkoutResult.data.operationId);
    harness.callbackRepository.write({
      scope: scopeA,
      data,
      isCurrent: harness.isCurrent,
    });

    expect(
      harness.callbackRepository.read({
        scope: scopeA,
        operationId: "operation_2" as BookingPaymentOperationId,
      }),
    ).toEqual({ status: "rejected", reason: "operation-mismatch" });
    expect(harness.storage.getItem(callbackKey)).not.toBeNull();
  });

  it("expires and purges callback state independently from checkout", () => {
    const harness = setup();
    const checkoutResult = writeCheckout(harness);
    if (checkoutResult.status !== "written") throw new Error("fixture failed");
    const data = callbackFor(checkoutResult.data.operationId);
    harness.callbackRepository.write({
      scope: scopeA,
      data,
      isCurrent: harness.isCurrent,
    });
    harness.setNow(901_000);

    expect(harness.callbackRepository.read({ scope: scopeA })).toEqual({
      status: "rejected",
      reason: "expired",
    });
    expect(harness.storage.getItem(callbackKey)).toBeNull();
  });

  it("refreshes the joined checkout so it always outlives a late callback", () => {
    const harness = setup();
    const checkoutResult = writeCheckout(harness);
    if (checkoutResult.status !== "written") throw new Error("fixture failed");
    harness.setNow(3_500_000);
    const data = callbackFor(checkoutResult.data.operationId);

    expect(
      harness.callbackRepository.write({
        scope: scopeA,
        data,
        isCurrent: harness.isCurrent,
      }),
    ).toEqual({ status: "written", data });

    const checkoutEnvelope = JSON.parse(
      harness.storage.getItem(checkoutKey) ?? "{}",
    );
    const callbackEnvelope = JSON.parse(
      harness.storage.getItem(callbackKey) ?? "{}",
    );
    expect(checkoutEnvelope.createdAt).toBe(3_500_000);
    expect(checkoutEnvelope.expiresAt).toBe(7_100_000);
    expect(callbackEnvelope.expiresAt).toBe(4_400_000);
    expect(checkoutEnvelope.expiresAt).toBeGreaterThan(
      callbackEnvelope.expiresAt,
    );
  });

  it("purges the old confirmed marker and returns only a reconcile hint", () => {
    const harness = setup();
    const marker =
      "airbob:payment-confirmed:reservation-7|payment_key_7|120000";
    harness.storage.setItem(marker, "1");

    expect(
      harness.callbackRepository.consumeLegacyConfirmedPaymentHint({
        orderId: "reservation-7",
        paymentKey: "payment_key_7",
        amount: 120_000,
      }),
    ).toEqual({ status: "hint", shouldReconcile: true });
    expect(harness.storage.getItem(marker)).toBeNull();
  });

  it("a stale epoch callback read cannot purge the next session record", () => {
    const harness = setup();
    const checkoutResult = writeCheckout(harness);
    if (checkoutResult.status !== "written") throw new Error("fixture failed");
    const data = callbackFor(checkoutResult.data.operationId);
    harness.callbackRepository.write({
      scope: scopeA,
      data,
      isCurrent: harness.isCurrent,
    });
    const nextSessionEnvelope = JSON.parse(
      harness.storage.getItem(callbackKey) ?? "{}",
    );
    nextSessionEnvelope.owner = scopeB.subject;
    harness.storage.setItem(callbackKey, JSON.stringify(nextSessionEnvelope));
    harness.setEpoch(8);

    expect(harness.callbackRepository.read({ scope: scopeA })).toEqual({
      status: "rejected",
      reason: "stale-session",
    });
    expect(harness.storage.getItem(callbackKey)).not.toBeNull();
  });
});

describe("legacy checkout migration", () => {
  it("migrates a verified legacy location candidate without customer fields", async () => {
    const harness = setup();
    const verify = jest.fn().mockResolvedValue({ status: "verified" });

    await expect(
      harness.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        rawLegacyLocationCandidate: legacyCheckout,
        verify,
        isCurrent: harness.isCurrent,
      }),
    ).resolves.toEqual({
      status: "migrated",
      data: { operationId: "operation_1", ...checkout },
      handle: expect.any(Object),
    });
    expect(verify).toHaveBeenCalledWith({
      accommodationId: 7,
      reservationUid: checkout.reservationUid,
      orderName: checkout.orderName,
      amount: checkout.amount,
      checkIn: checkout.checkIn,
      checkOut: checkout.checkOut,
      guestCount: checkout.adultOccupancy + checkout.childOccupancy,
    });
    expect(harness.storage.getItem(legacyPrimaryKey)).toBeNull();
    expect(harness.storage.getItem(legacyIndexKey)).toBeNull();
    expect(harness.storage.getItem(checkoutKey)).not.toContain(
      legacyCheckout.customerEmail,
    );
    expect(harness.storage.getItem(checkoutKey)).not.toContain(
      legacyCheckout.customerName,
    );
  });

  it("location migration wins but also removes a different stored legacy index", async () => {
    const harness = setup();
    const storedLegacy = {
      ...legacyCheckout,
      reservationUid: "reservation-stored-other",
    };
    const storedIndex =
      "airbob:reservation-checkout-index:reservation-stored-other";
    harness.storage.setItem(legacyPrimaryKey, JSON.stringify(storedLegacy));
    harness.storage.setItem(storedIndex, "7");
    harness.storage.setItem(legacyIndexKey, "7");

    await expect(
      harness.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        rawLegacyLocationCandidate: legacyCheckout,
        verify: jest.fn().mockResolvedValue({ status: "verified" }),
        isCurrent: harness.isCurrent,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: "migrated" }));
    expect(harness.storage.getItem(legacyPrimaryKey)).toBeNull();
    expect(harness.storage.getItem(storedIndex)).toBeNull();
    expect(harness.storage.getItem(legacyIndexKey)).toBeNull();
  });

  it("requires the exact stored primary and matching reservation index", async () => {
    const mismatched = setup();
    mismatched.storage.setItem(
      legacyPrimaryKey,
      JSON.stringify(legacyCheckout),
    );
    mismatched.storage.setItem(legacyIndexKey, "8");
    const verify = jest.fn().mockResolvedValue({ status: "verified" });

    await expect(
      mismatched.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        verify,
        isCurrent: mismatched.isCurrent,
      }),
    ).resolves.toEqual({ status: "rejected", reason: "index-mismatch" });
    expect(verify).not.toHaveBeenCalled();
    expect(mismatched.storage.getItem(legacyPrimaryKey)).toBeNull();
    expect(mismatched.storage.getItem(legacyIndexKey)).toBeNull();

    const accepted = setup();
    accepted.storage.setItem(legacyPrimaryKey, JSON.stringify(legacyCheckout));
    accepted.storage.setItem(legacyIndexKey, "7");
    await expect(
      accepted.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        verify,
        isCurrent: accepted.isCurrent,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: "migrated" }));
  });

  it("rejects unknown legacy fields and failed server verification", async () => {
    const malformed = setup();
    malformed.storage.setItem(
      legacyPrimaryKey,
      JSON.stringify({ ...legacyCheckout, extra: "reject" }),
    );
    await expect(
      malformed.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        verify: jest.fn().mockResolvedValue({ status: "verified" }),
        isCurrent: malformed.isCurrent,
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "invalid-legacy-data",
    });
    expect(malformed.storage.getItem(legacyPrimaryKey)).toBeNull();

    const rejected = setup();
    rejected.storage.setItem(legacyPrimaryKey, JSON.stringify(legacyCheckout));
    rejected.storage.setItem(legacyIndexKey, "7");
    await expect(
      rejected.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        verify: jest.fn().mockResolvedValue({ status: "mismatch" }),
        isCurrent: rejected.isCurrent,
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "verification-failed",
    });
    expect(rejected.storage.getItem(legacyPrimaryKey)).toBeNull();
    expect(rejected.storage.getItem(legacyIndexKey)).toBeNull();
  });

  it.each([
    [
      "a classified retryable result",
      () => Promise.resolve({ status: "retryable-error" as const }),
    ],
    [
      "a thrown transport error",
      () => Promise.reject(new Error("offline")),
    ],
  ])(
    "preserves the exact legacy primary and index after %s",
    async (_case, verify) => {
      const harness = setup();
      const rawPrimary = JSON.stringify(legacyCheckout);
      harness.storage.setItem(legacyPrimaryKey, rawPrimary);
      harness.storage.setItem(legacyIndexKey, "7");

      await expect(
        harness.checkoutRepository.migrateLegacy({
          scope: scopeA,
          accommodationId: 7,
          verify,
          isCurrent: harness.isCurrent,
        }),
      ).resolves.toEqual({ status: "verification-retryable" });
      expect(harness.storage.getItem(legacyPrimaryKey)).toBe(rawPrimary);
      expect(harness.storage.getItem(legacyIndexKey)).toBe("7");
      expect(harness.storage.getItem(checkoutKey)).toBeNull();
    },
  );

  it("surfaces fail-closed cleanup errors on every legacy rejection path", async () => {
    const malformedStorage = createStorage({ [legacyPrimaryKey]: "{" });
    jest.spyOn(malformedStorage, "removeItem").mockImplementation(() => {
      throw new Error("cleanup blocked");
    });
    const malformed = setup({ storage: malformedStorage });
    await expect(
      malformed.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        verify: jest.fn().mockResolvedValue({ status: "verified" }),
        isCurrent: malformed.isCurrent,
      }),
    ).resolves.toEqual({ status: "rejected", reason: "cleanup-failed" });

    const indexStorage = createStorage({
      [legacyPrimaryKey]: JSON.stringify(legacyCheckout),
      [legacyIndexKey]: "8",
    });
    const originalIndexRemove = indexStorage.removeItem.bind(indexStorage);
    jest.spyOn(indexStorage, "removeItem").mockImplementation((key) => {
      if (key === legacyIndexKey) throw new Error("cleanup blocked");
      originalIndexRemove(key);
    });
    const indexMismatch = setup({ storage: indexStorage });
    await expect(
      indexMismatch.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        verify: jest.fn().mockResolvedValue({ status: "verified" }),
        isCurrent: indexMismatch.isCurrent,
      }),
    ).resolves.toEqual({ status: "rejected", reason: "cleanup-failed" });

    const verificationStorage = createStorage({
      [legacyPrimaryKey]: JSON.stringify(legacyCheckout),
      [legacyIndexKey]: "7",
    });
    const originalVerificationRemove =
      verificationStorage.removeItem.bind(verificationStorage);
    jest.spyOn(verificationStorage, "removeItem").mockImplementation((key) => {
      if (key === legacyIndexKey) throw new Error("cleanup blocked");
      originalVerificationRemove(key);
    });
    const verificationFailed = setup({ storage: verificationStorage });
    await expect(
      verificationFailed.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        verify: jest.fn().mockResolvedValue({ status: "mismatch" }),
        isCurrent: verificationFailed.isCurrent,
      }),
    ).resolves.toEqual({ status: "rejected", reason: "cleanup-failed" });
  });

  it("lets an existing owned target win without invoking legacy verification", async () => {
    const harness = setup();
    const target = writeCheckout(harness);
    if (target.status !== "written") throw new Error("fixture failed");
    harness.storage.setItem(legacyPrimaryKey, JSON.stringify(legacyCheckout));
    harness.storage.setItem(legacyIndexKey, "7");
    const verify = jest.fn().mockResolvedValue({ status: "verified" });

    await expect(
      harness.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        verify,
        isCurrent: harness.isCurrent,
      }),
    ).resolves.toEqual({
      status: "target-wins",
      data: target.data,
      handle: target.handle,
    });
    expect(verify).not.toHaveBeenCalled();
    expect(harness.storage.getItem(legacyPrimaryKey)).toBeNull();
    expect(harness.storage.getItem(legacyIndexKey)).toBeNull();
  });

  it("does not let a malformed location handoff fall through to an owned target", async () => {
    const harness = setup();
    writeCheckout(harness);
    const verify = jest.fn().mockResolvedValue({ status: "verified" });

    await expect(
      harness.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        rawLegacyLocationCandidate: { forged: true },
        verify,
        isCurrent: harness.isCurrent,
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "invalid-legacy-data",
    });
    expect(verify).not.toHaveBeenCalled();
    expect(
      harness.checkoutRepository.read({
        scope: scopeA,
        accommodationId: 7,
        locationState: null,
      }),
    ).toEqual(expect.objectContaining({ status: "found" }));
  });

  it("target-wins cleanup removes the index named by the actual legacy record", async () => {
    const harness = setup();
    const target = writeCheckout(harness);
    if (target.status !== "written") throw new Error("fixture failed");
    const otherLegacy = {
      ...legacyCheckout,
      reservationUid: "reservation-legacy-other",
    };
    const otherIndex =
      "airbob:reservation-checkout-index:reservation-legacy-other";
    harness.storage.setItem(legacyPrimaryKey, JSON.stringify(otherLegacy));
    harness.storage.setItem(otherIndex, "7");
    harness.storage.setItem(legacyIndexKey, "7");

    await expect(
      harness.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        verify: jest.fn().mockResolvedValue({ status: "verified" }),
        isCurrent: harness.isCurrent,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: "target-wins" }));
    expect(harness.storage.getItem(legacyPrimaryKey)).toBeNull();
    expect(harness.storage.getItem(otherIndex)).toBeNull();
    expect(harness.storage.getItem(legacyIndexKey)).toBeNull();
  });

  it("never overwrites a valid owned target for another accommodation", async () => {
    const harness = setup();
    const target = harness.checkoutRepository.write({
      scope: scopeA,
      data: {
        ...checkout,
        accommodationId: 8,
        reservationUid: "reservation-8",
      },
      isCurrent: harness.isCurrent,
    });
    if (target.status !== "written") throw new Error("fixture failed");
    harness.storage.setItem(legacyPrimaryKey, JSON.stringify(legacyCheckout));
    harness.storage.setItem(legacyIndexKey, "7");

    await expect(
      harness.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        verify: jest.fn().mockResolvedValue({ status: "verified" }),
        isCurrent: harness.isCurrent,
      }),
    ).resolves.toEqual({
      status: "target-wins",
      data: target.data,
      handle: target.handle,
    });
    expect(
      JSON.parse(harness.storage.getItem(checkoutKey) ?? "{}").data,
    ).toEqual(target.data);
    expect(harness.storage.getItem(legacyPrimaryKey)).toBeNull();
    expect(harness.storage.getItem(legacyIndexKey)).toBeNull();
  });

  it("does not write or clean legacy data after an epoch fence changes", async () => {
    const harness = setup();
    harness.storage.setItem(legacyPrimaryKey, JSON.stringify(legacyCheckout));
    harness.storage.setItem(legacyIndexKey, "7");
    let resolveVerification!: (value: { status: "verified" }) => void;
    const verify = () =>
      new Promise<{ status: "verified" }>((resolve) => {
        resolveVerification = resolve;
      });

    const migration = harness.checkoutRepository.migrateLegacy({
      scope: scopeA,
      accommodationId: 7,
      verify,
      isCurrent: harness.isCurrent,
    });
    await Promise.resolve();
    harness.setEpoch(8);
    resolveVerification({ status: "verified" });

    await expect(migration).resolves.toEqual({ status: "stale" });
    expect(harness.storage.getItem(checkoutKey)).toBeNull();
    expect(harness.storage.getItem(legacyPrimaryKey)).not.toBeNull();
    expect(harness.storage.getItem(legacyIndexKey)).toBe("7");
  });

  it("fails closed and removes the new target when legacy cleanup is partial", async () => {
    const storage = createStorage({
      [legacyPrimaryKey]: JSON.stringify(legacyCheckout),
      [legacyIndexKey]: "7",
    });
    const originalRemove = storage.removeItem.bind(storage);
    jest.spyOn(storage, "removeItem").mockImplementation((key) => {
      if (key === legacyIndexKey) throw new Error("legacy cleanup blocked");
      originalRemove(key);
    });
    const harness = setup({ storage });

    await expect(
      harness.checkoutRepository.migrateLegacy({
        scope: scopeA,
        accommodationId: 7,
        verify: jest.fn().mockResolvedValue({ status: "verified" }),
        isCurrent: harness.isCurrent,
      }),
    ).resolves.toEqual({ status: "rejected", reason: "cleanup-failed" });
    expect(harness.storage.getItem(checkoutKey)).toBeNull();
  });
});

describe("booking-payment browser cleanup and failures", () => {
  it("clears only the new namespace plus exact legacy prefixes", () => {
    const harness = setup();
    writeCheckout(harness);
    harness.storage.setItem(callbackKey, "callback");
    harness.storage.setItem(legacyPrimaryKey, "legacy");
    harness.storage.setItem(legacyIndexKey, "7");
    harness.storage.setItem("airbob:payment-confirmed:tuple", "1");
    harness.storage.setItem("airbob:booking-payment-v10:checkout", "keep");
    harness.storage.setItem("airbob:reservation-checkouts:7", "keep");
    harness.storage.setItem("third-party", "keep");

    expect(
      clearBookingPaymentBrowserState({ driver: harness.driver }),
    ).toEqual({ status: "cleared", removed: 5 });
    expect(harness.storage.getItem("airbob:booking-payment-v10:checkout")).toBe(
      "keep",
    );
    expect(harness.storage.getItem("airbob:reservation-checkouts:7")).toBe(
      "keep",
    );
    expect(harness.storage.getItem("third-party")).toBe("keep");
  });

  it("retries partial current and legacy namespace cleanup once", () => {
    const storage = createStorage({
      [checkoutKey]: "checkout",
      [callbackKey]: "callback",
      [legacyPrimaryKey]: "legacy",
      [legacyIndexKey]: "7",
      keep: "keep",
    });
    const originalRemove = storage.removeItem.bind(storage);
    const failedOnce = new Set<string>();
    jest.spyOn(storage, "removeItem").mockImplementation((key) => {
      if (
        (key === callbackKey || key === legacyIndexKey) &&
        !failedOnce.has(key)
      ) {
        failedOnce.add(key);
        throw new Error("transient cleanup failure");
      }
      originalRemove(key);
    });
    const driver = createSessionStorageDriver({ getStorage: () => storage });

    expect(clearBookingPaymentBrowserState({ driver })).toEqual({
      status: "cleared",
      removed: 4,
    });
    expect(storage.getItem(checkoutKey)).toBeNull();
    expect(storage.getItem(callbackKey)).toBeNull();
    expect(storage.getItem(legacyPrimaryKey)).toBeNull();
    expect(storage.getItem(legacyIndexKey)).toBeNull();
    expect(storage.getItem("keep")).toBe("keep");
  });

  it("retries a namespace enumeration error and returns the verified result", () => {
    const storage = createStorage({ [checkoutKey]: "checkout" });
    const originalKey = storage.key.bind(storage);
    let failedOnce = false;
    jest.spyOn(storage, "key").mockImplementation((index) => {
      if (!failedOnce) {
        failedOnce = true;
        throw new Error("transient key enumeration failure");
      }
      return originalKey(index);
    });
    const driver = createSessionStorageDriver({ getStorage: () => storage });

    expect(clearBookingPaymentBrowserState({ driver })).toEqual({
      status: "cleared",
      removed: 1,
    });
    expect(storage.getItem(checkoutKey)).toBeNull();
  });

  it("reports a final partial cleanup only after its retry also fails", () => {
    const storage = createStorage({
      [checkoutKey]: "checkout",
      [callbackKey]: "callback",
    });
    const originalRemove = storage.removeItem.bind(storage);
    const remove = jest
      .spyOn(storage, "removeItem")
      .mockImplementation((key) => {
        if (key === callbackKey) throw new Error("persistent cleanup failure");
        originalRemove(key);
      });
    const driver = createSessionStorageDriver({ getStorage: () => storage });

    expect(clearBookingPaymentBrowserState({ driver })).toEqual({
      status: "partial",
      removed: 1,
      failed: 1,
    });
    expect(
      remove.mock.calls.filter(([key]) => key === callbackKey),
    ).toHaveLength(2);
    expect(storage.getItem(callbackKey)).toBe("callback");
  });

  it("returns typed storage errors from reads and writes", () => {
    const getFailureStorage = createStorage();
    jest.spyOn(getFailureStorage, "getItem").mockImplementation(() => {
      throw new Error("secret read body");
    });
    const readHarness = setup({ storage: getFailureStorage });
    expect(
      readHarness.checkoutRepository.read({
        scope: scopeA,
        accommodationId: 7,
        locationState: null,
      }),
    ).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "get" },
    });

    const setFailureStorage = createStorage();
    jest.spyOn(setFailureStorage, "setItem").mockImplementation(() => {
      throw new Error("secret write body");
    });
    const writeHarness = setup({ storage: setFailureStorage });
    expect(writeCheckout(writeHarness)).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "set" },
    });
  });
});
