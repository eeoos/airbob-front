import { createSessionStorageDriver } from "./sessionStorageDriver";
import { createLegacyBookingPaymentStorage } from "./legacyBookingPaymentStorage";

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

const createRepository = (storage = createStorage()) => ({
  storage,
  repository: createLegacyBookingPaymentStorage(
    createSessionStorageDriver({ getStorage: () => storage }),
  ),
});

describe("createLegacyBookingPaymentStorage", () => {
  it("reads only the exact checkout and matching index keys", () => {
    const { storage, repository } = createRepository();
    storage.setItem("airbob:reservation-checkout:7", "checkout");
    storage.setItem("airbob:reservation-checkout-index:reservation-7", "7");

    expect(repository.readCheckout(7)).toEqual({
      status: "found",
      raw: "checkout",
    });
    expect(repository.readCheckoutIndex("reservation-7")).toEqual({
      status: "found",
      raw: "7",
    });
    expect(repository.readCheckout(8)).toEqual({ status: "missing" });
    expect(repository.readCheckoutIndex("reservation-8")).toEqual({
      status: "missing",
    });
  });

  it("rejects dynamic key material that could escape an owned prefix", () => {
    const { repository } = createRepository();

    expect(repository.readCheckout(0)).toEqual({ status: "invalid-key" });
    expect(repository.readCheckoutIndex(" reservation-7")).toEqual({
      status: "invalid-key",
    });
    expect(
      repository.consumeConfirmedPaymentHint({
        orderId: "",
        paymentKey: "payment-key",
        amount: 1,
      }),
    ).toEqual({ status: "invalid-key" });
  });

  it("treats a confirmed marker only as a one-shot reconciliation hint", () => {
    const { storage, repository } = createRepository();
    const tuple = {
      orderId: "reservation/7",
      paymentKey: "payment key",
      amount: 120_000,
    };
    const marker =
      "airbob:payment-confirmed:reservation%2F7|payment%20key|120000";
    storage.setItem(marker, "1");

    expect(repository.consumeConfirmedPaymentHint(tuple)).toEqual({
      status: "hint",
      shouldReconcile: true,
    });
    expect(storage.getItem(marker)).toBeNull();
    expect(repository.consumeConfirmedPaymentHint(tuple)).toEqual({
      status: "hint",
      shouldReconcile: false,
    });
  });

  it("clears only the three exact legacy booking-payment prefixes", () => {
    const { storage, repository } = createRepository();
    storage.setItem("airbob:reservation-checkout:7", "checkout");
    storage.setItem("airbob:reservation-checkout-index:reservation-7", "7");
    storage.setItem("airbob:payment-confirmed:tuple", "1");
    storage.setItem("airbob:reservation-checkouts:7", "keep");
    storage.setItem("airbob:booking-payment-v1:checkout", "keep");
    storage.setItem("third-party", "keep");

    expect(repository.clearAll()).toEqual({ status: "cleared", removed: 3 });
    expect(storage.getItem("airbob:reservation-checkouts:7")).toBe("keep");
    expect(storage.getItem("airbob:booking-payment-v1:checkout")).toBe("keep");
    expect(storage.getItem("third-party")).toBe("keep");
  });

  it("reports partial cleanup and never widens its deletion scope", () => {
    const storage = createStorage({
      "airbob:reservation-checkout:7": "checkout",
      "airbob:reservation-checkout-index:reservation-7": "7",
      keep: "keep",
    });
    const originalRemove = storage.removeItem.bind(storage);
    vi.spyOn(storage, "removeItem").mockImplementation((key) => {
      if (key.includes("checkout-index")) throw new Error("blocked");
      originalRemove(key);
    });
    const { repository } = createRepository(storage);

    expect(repository.clearCheckout(7, "reservation-7")).toEqual({
      status: "partial",
      removed: 1,
      failed: 1,
    });
    expect(storage.getItem("keep")).toBe("keep");
  });

  it("returns redacted typed storage errors", () => {
    const storage = createStorage();
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("raw checkout secret");
    });
    const { repository } = createRepository(storage);

    const result = repository.readCheckout(7);
    expect(result).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "get" },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
