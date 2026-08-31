import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import { createSessionStorageDriver } from "../../../platform/storage/sessionStorageDriverCore";
import {
  clearBookingPaymentBrowserState,
  createBookingPaymentCallbackRepository,
  createBookingPaymentCheckoutRepository,
} from "./repositories";
import type {
  BookingPaymentOperationId,
  CallbackData,
  CheckoutHandoffState,
} from "./types";

type CheckoutWriteData = Parameters<
  ReturnType<typeof createBookingPaymentCheckoutRepository>["write"]
>[0]["data"];

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
    createOperationId: () => {
      const operationId = operationIds.at(
        Math.min(operationIndex++, operationIds.length - 1),
      );
      if (!operationId)
        throw new Error("Expected a booking operation id fixture");
      return operationId;
    },
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
const retiredPrimaryKey = "airbob:reservation-checkout:7";
const retiredIndexKey = "airbob:reservation-checkout-index:reservation-7";
const retiredMarkerKey = "airbob:payment-confirmed:tuple";

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
    ["path-shaped reservation", { reservationUid: "../admin" }],
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
    [
      "unknown-fields",
      (record: Record<string, unknown>) => ({ ...record, extra: 1 }),
    ],
    [
      "wrong-version",
      (record: Record<string, unknown>) => ({ ...record, version: 2 }),
    ],
    [
      "wrong-purpose",
      (record: Record<string, unknown>) => ({ ...record, purpose: "other" }),
    ],
    [
      "invalid-data",
      (record: Record<string, unknown>) => ({
        ...record,
        data: { ...(record.data as object), amount: 0 },
      }),
    ],
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

describe("booking-payment browser cleanup and failures", () => {
  it("clears the current namespace and purge-only retired payment prefixes", () => {
    const harness = setup();
    writeCheckout(harness);
    harness.storage.setItem(callbackKey, "callback");
    harness.storage.setItem(retiredPrimaryKey, "retired");
    harness.storage.setItem(retiredIndexKey, "7");
    harness.storage.setItem(retiredMarkerKey, "1");
    harness.storage.setItem("airbob:booking-payment-v10:checkout", "keep");
    harness.storage.setItem("airbob:reservation-checkouts:7", "keep");
    harness.storage.setItem("third-party", "keep");

    expect(clearBookingPaymentBrowserState({ driver: harness.driver })).toEqual(
      { status: "cleared", removed: 5 },
    );
    expect(harness.storage.getItem(retiredPrimaryKey)).toBeNull();
    expect(harness.storage.getItem(retiredIndexKey)).toBeNull();
    expect(harness.storage.getItem(retiredMarkerKey)).toBeNull();
    expect(harness.storage.getItem("airbob:booking-payment-v10:checkout")).toBe(
      "keep",
    );
    expect(harness.storage.getItem("airbob:reservation-checkouts:7")).toBe(
      "keep",
    );
    expect(harness.storage.getItem("third-party")).toBe("keep");
  });

  it("retries a partial current namespace cleanup once", () => {
    const storage = createStorage({
      [checkoutKey]: "checkout",
      [callbackKey]: "callback",
      keep: "keep",
    });
    const originalRemove = storage.removeItem.bind(storage);
    const failedOnce = new Set<string>();
    vi.spyOn(storage, "removeItem").mockImplementation((key) => {
      if (key === callbackKey && !failedOnce.has(key)) {
        failedOnce.add(key);
        throw new Error("transient cleanup failure");
      }
      originalRemove(key);
    });
    const driver = createSessionStorageDriver({ getStorage: () => storage });

    expect(clearBookingPaymentBrowserState({ driver })).toEqual({
      status: "cleared",
      removed: 2,
    });
    expect(storage.getItem(checkoutKey)).toBeNull();
    expect(storage.getItem(callbackKey)).toBeNull();
    expect(storage.getItem("keep")).toBe("keep");
  });

  it("retries a namespace enumeration error and returns the verified result", () => {
    const storage = createStorage({ [checkoutKey]: "checkout" });
    const originalKey = storage.key.bind(storage);
    let failedOnce = false;
    vi.spyOn(storage, "key").mockImplementation((index) => {
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
    const remove = vi.spyOn(storage, "removeItem").mockImplementation((key) => {
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

  it("fails closed when purge-only retired payment cleanup cannot complete", () => {
    const storage = createStorage({
      [retiredPrimaryKey]: "retired-checkout-with-personal-data",
      keep: "keep",
    });
    const originalRemove = storage.removeItem.bind(storage);
    const remove = vi.spyOn(storage, "removeItem").mockImplementation((key) => {
      if (key === retiredPrimaryKey) {
        throw new Error("persistent retired cleanup failure");
      }
      originalRemove(key);
    });
    const driver = createSessionStorageDriver({ getStorage: () => storage });

    expect(clearBookingPaymentBrowserState({ driver })).toEqual({
      status: "partial",
      removed: 0,
      failed: 1,
    });
    expect(
      remove.mock.calls.filter(([key]) => key === retiredPrimaryKey),
    ).toHaveLength(2);
    expect(storage.getItem(retiredPrimaryKey)).not.toBeNull();
    expect(storage.getItem("keep")).toBe("keep");
  });

  it("returns typed storage errors from reads and writes", () => {
    const getFailureStorage = createStorage();
    vi.spyOn(getFailureStorage, "getItem").mockImplementation(() => {
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
    vi.spyOn(setFailureStorage, "setItem").mockImplementation(() => {
      throw new Error("secret write body");
    });
    const writeHarness = setup({ storage: setFailureStorage });
    expect(writeCheckout(writeHarness)).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "set" },
    });
  });
});
