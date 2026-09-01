import { createSessionStorageDriver } from "../../../platform/storage/sessionStorageDriverCore";
import {
  clearIdentityOwnedBookingPaymentBrowserState,
  clearTerminalBookingPaymentBrowserState,
} from "./retiredState";

const v1CheckoutKey = "airbob:booking-payment-v1:checkout";
const v1CallbackKey = "airbob:booking-payment-v1:callback";
const v2JournalKey = "airbob:booking-payment-v2:journal";
const v2CredentialKey = "airbob:booking-payment-v2:callback-credential";
const v2ReceiptKey = "airbob:booking-payment-v2:operation-receipt";
const retiredCheckoutKey = "airbob:reservation-checkout:7";
const retiredIndexKey = "airbob:reservation-checkout-index:reservation-7";
const retiredMarkerKey = "airbob:payment-confirmed:tuple";

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

describe("retired booking-payment browser state", () => {
  it("terminal cleanup removes only v1 and retired exact-prefix matches", () => {
    const harness = createStorageHarness({
      [v1CheckoutKey]: "secret-v1-checkout",
      [v1CallbackKey]: "secret-v1-callback",
      [retiredCheckoutKey]: "secret-retired-checkout",
      [retiredIndexKey]: "secret-retired-index",
      [retiredMarkerKey]: "secret-retired-marker",
      [v2JournalKey]: "unresolved-v2-recovery",
      "airbob:booking-payment-v10:checkout": "keep-v10",
      "airbob:booking-payment-v20:journal": "keep-v20",
      "airbob:reservation-checkouts:7": "keep-plural",
      "airbob:reservation-checkout": "keep-without-colon",
      "airbob:unrelated": "keep-airbob",
      "third-party": "keep-third-party",
    });
    const getItem = vi.spyOn(harness.storage, "getItem");

    expect(
      clearTerminalBookingPaymentBrowserState({ driver: harness.driver }),
    ).toEqual({ status: "cleared", removed: 5 });
    expect(getItem).not.toHaveBeenCalled();
    expect([...harness.values]).toEqual([
      [v2JournalKey, "unresolved-v2-recovery"],
      ["airbob:booking-payment-v10:checkout", "keep-v10"],
      ["airbob:booking-payment-v20:journal", "keep-v20"],
      ["airbob:reservation-checkouts:7", "keep-plural"],
      ["airbob:reservation-checkout", "keep-without-colon"],
      ["airbob:unrelated", "keep-airbob"],
      ["third-party", "keep-third-party"],
    ]);
  });

  it("identity cleanup additionally removes v2 without reading any payload", () => {
    const harness = createStorageHarness({
      [v1CheckoutKey]: "secret-v1-checkout",
      [v2JournalKey]: "secret-v2-journal",
      [v2CredentialKey]: "secret-credential",
      [v2ReceiptKey]: "secret-receipt",
      [retiredCheckoutKey]: "secret-retired-checkout",
      "airbob:booking-payment-v20:journal": "keep-v20",
      unrelated: "keep",
    });
    const getItem = vi.spyOn(harness.storage, "getItem");
    const removeItem = vi.spyOn(harness.storage, "removeItem");

    expect(
      clearIdentityOwnedBookingPaymentBrowserState({
        driver: harness.driver,
      }),
    ).toEqual({ status: "cleared", removed: 5 });
    expect(getItem).not.toHaveBeenCalled();
    expect(
      removeItem.mock.calls
        .map(([key]) => key)
        .filter((key) =>
          [v2CredentialKey, v2JournalKey, v2ReceiptKey].includes(key),
        ),
    ).toEqual([v2CredentialKey, v2JournalKey, v2ReceiptKey]);
    expect(removeItem.mock.calls.at(-1)?.[0]).toBe(v2ReceiptKey);
    expect([...harness.values]).toEqual([
      ["airbob:booking-payment-v20:journal", "keep-v20"],
      ["unrelated", "keep"],
    ]);
  });

  it("preserves the receipt when a lower-authority v2 removal keeps failing", () => {
    const harness = createStorageHarness({
      [v2JournalKey]: "secret-v2-journal",
      [v2CredentialKey]: "secret-credential",
      [v2ReceiptKey]: "secret-receipt",
    });
    const originalRemove = harness.storage.removeItem.bind(harness.storage);
    const remove = vi
      .spyOn(harness.storage, "removeItem")
      .mockImplementation((key) => {
        if (key === v2CredentialKey) {
          throw new Error("persistent lower-authority removal failure");
        }
        originalRemove(key);
      });
    const getItem = vi.spyOn(harness.storage, "getItem");

    expect(
      clearIdentityOwnedBookingPaymentBrowserState({
        driver: harness.driver,
      }),
    ).toEqual({ status: "partial", removed: 1, failed: 2 });
    expect(
      remove.mock.calls.filter(([key]) => key === v2CredentialKey),
    ).toHaveLength(2);
    expect(
      remove.mock.calls.filter(([key]) => key === v2ReceiptKey),
    ).toHaveLength(0);
    expect(harness.values.has(v2CredentialKey)).toBe(true);
    expect(harness.values.has(v2JournalKey)).toBe(false);
    expect(harness.values.has(v2ReceiptKey)).toBe(true);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("removes the receipt only after a transient lower-authority failure is verified absent", () => {
    const harness = createStorageHarness({
      [v2JournalKey]: "secret-v2-journal",
      [v2CredentialKey]: "secret-credential",
      [v2ReceiptKey]: "secret-receipt",
    });
    const originalRemove = harness.storage.removeItem.bind(harness.storage);
    const remove = vi
      .spyOn(harness.storage, "removeItem")
      .mockImplementation((key) => {
        const credentialAttempts = remove.mock.calls.filter(
          ([calledKey]) => calledKey === v2CredentialKey,
        ).length;
        if (key === v2CredentialKey && credentialAttempts === 1) {
          throw new Error("transient lower-authority removal failure");
        }
        originalRemove(key);
      });
    const getItem = vi.spyOn(harness.storage, "getItem");

    expect(
      clearIdentityOwnedBookingPaymentBrowserState({
        driver: harness.driver,
      }),
    ).toEqual({ status: "cleared", removed: 3 });
    expect(remove.mock.calls.map(([key]) => key)).toEqual([
      v2CredentialKey,
      v2JournalKey,
      v2CredentialKey,
      v2ReceiptKey,
    ]);
    expect(getItem).not.toHaveBeenCalled();
    expect(harness.values.size).toBe(0);
  });

  it("preserves the receipt when a retired v1 removal keeps failing", () => {
    const harness = createStorageHarness({
      [v1CallbackKey]: "secret-v1-callback",
      [v2ReceiptKey]: "secret-receipt",
    });
    const originalRemove = harness.storage.removeItem.bind(harness.storage);
    const remove = vi
      .spyOn(harness.storage, "removeItem")
      .mockImplementation((key) => {
        if (key === v1CallbackKey) {
          throw new Error("persistent v1 removal failure");
        }
        originalRemove(key);
      });
    const getItem = vi.spyOn(harness.storage, "getItem");

    expect(
      clearIdentityOwnedBookingPaymentBrowserState({
        driver: harness.driver,
      }),
    ).toEqual({ status: "partial", removed: 0, failed: 2 });
    expect(
      remove.mock.calls.filter(([key]) => key === v1CallbackKey),
    ).toHaveLength(2);
    expect(
      remove.mock.calls.filter(([key]) => key === v2ReceiptKey),
    ).toHaveLength(0);
    expect(harness.values.has(v1CallbackKey)).toBe(true);
    expect(harness.values.has(v2ReceiptKey)).toBe(true);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("removes the receipt after a transient retired v1 failure is verified absent", () => {
    const harness = createStorageHarness({
      [v1CallbackKey]: "secret-v1-callback",
      [v2ReceiptKey]: "secret-receipt",
    });
    const originalRemove = harness.storage.removeItem.bind(harness.storage);
    const remove = vi
      .spyOn(harness.storage, "removeItem")
      .mockImplementation((key) => {
        const v1Attempts = remove.mock.calls.filter(
          ([calledKey]) => calledKey === v1CallbackKey,
        ).length;
        if (key === v1CallbackKey && v1Attempts === 1) {
          throw new Error("transient v1 removal failure");
        }
        originalRemove(key);
      });
    const getItem = vi.spyOn(harness.storage, "getItem");

    expect(
      clearIdentityOwnedBookingPaymentBrowserState({
        driver: harness.driver,
      }),
    ).toEqual({ status: "cleared", removed: 2 });
    expect(remove.mock.calls.map(([key]) => key)).toEqual([
      v1CallbackKey,
      v1CallbackKey,
      v2ReceiptKey,
    ]);
    expect(getItem).not.toHaveBeenCalled();
    expect(harness.values.size).toBe(0);
  });

  it("re-enumerates and retries only the keys that remain", () => {
    const harness = createStorageHarness({
      [v1CheckoutKey]: "checkout",
      [v1CallbackKey]: "callback",
    });
    const originalRemove = harness.storage.removeItem.bind(harness.storage);
    const remove = vi
      .spyOn(harness.storage, "removeItem")
      .mockImplementation((key) => {
        if (
          key === v1CallbackKey &&
          remove.mock.calls.filter(([calledKey]) => calledKey === key)
            .length === 1
        ) {
          throw new Error("transient remove failure with secret body");
        }
        originalRemove(key);
      });

    expect(
      clearTerminalBookingPaymentBrowserState({ driver: harness.driver }),
    ).toEqual({ status: "cleared", removed: 2 });
    expect(
      remove.mock.calls.filter(([key]) => key === v1CheckoutKey),
    ).toHaveLength(1);
    expect(
      remove.mock.calls.filter(([key]) => key === v1CallbackKey),
    ).toHaveLength(2);
  });

  it("reports a verified partial result after two failed removals", () => {
    const harness = createStorageHarness({
      [v1CheckoutKey]: "checkout",
      [v1CallbackKey]: "callback",
    });
    const originalRemove = harness.storage.removeItem.bind(harness.storage);
    const remove = vi
      .spyOn(harness.storage, "removeItem")
      .mockImplementation((key) => {
        if (key === v1CallbackKey) {
          throw new Error("persistent remove failure with secret body");
        }
        originalRemove(key);
      });

    expect(
      clearTerminalBookingPaymentBrowserState({ driver: harness.driver }),
    ).toEqual({ status: "partial", removed: 1, failed: 1 });
    expect(
      remove.mock.calls.filter(([key]) => key === v1CallbackKey),
    ).toHaveLength(2);
    expect(harness.values.has(v1CallbackKey)).toBe(true);
  });

  it("detects a success-returning no-op removal through final enumeration", () => {
    const harness = createStorageHarness({
      [v1CheckoutKey]: "secret-checkout",
    });
    const remove = vi
      .spyOn(harness.storage, "removeItem")
      .mockImplementation(() => undefined);

    expect(
      clearTerminalBookingPaymentBrowserState({ driver: harness.driver }),
    ).toEqual({ status: "partial", removed: 0, failed: 1 });
    expect(remove).toHaveBeenCalledTimes(2);
    expect(harness.values.has(v1CheckoutKey)).toBe(true);
  });

  it("recovers from a transient initial enumeration failure", () => {
    const harness = createStorageHarness({
      [v1CheckoutKey]: "secret-checkout",
    });
    const originalKeys = harness.driver.keys.bind(harness.driver);
    const keys = vi.spyOn(harness.driver, "keys").mockImplementationOnce(() => {
      return {
        ok: false,
        error: { kind: "storage-unavailable", operation: "keys" },
      };
    });
    const getItem = vi.spyOn(harness.driver, "getItem");
    keys.mockImplementation(originalKeys);

    expect(
      clearTerminalBookingPaymentBrowserState({ driver: harness.driver }),
    ).toEqual({ status: "cleared", removed: 1 });
    expect(keys).toHaveBeenCalledTimes(3);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("returns a typed error after persistent initial enumeration failures", () => {
    const harness = createStorageHarness({
      [v1CheckoutKey]: "secret-checkout",
    });
    const keys = vi.spyOn(harness.driver, "keys").mockReturnValue({
      ok: false,
      error: { kind: "storage-unavailable", operation: "keys" },
    });
    const remove = vi.spyOn(harness.driver, "removeItem");
    const getItem = vi.spyOn(harness.driver, "getItem");

    expect(
      clearTerminalBookingPaymentBrowserState({ driver: harness.driver }),
    ).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "keys" },
    });
    expect(keys).toHaveBeenCalledTimes(2);
    expect(remove).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it("recovers from a transient verification enumeration failure", () => {
    const harness = createStorageHarness({
      [v1CheckoutKey]: "secret-checkout",
    });
    const originalKeys = harness.driver.keys.bind(harness.driver);
    let enumeration = 0;
    const keys = vi.spyOn(harness.driver, "keys").mockImplementation(() => {
      enumeration += 1;
      return enumeration === 2
        ? {
            ok: false,
            error: { kind: "storage-unavailable", operation: "keys" },
          }
        : originalKeys();
    });
    const getItem = vi.spyOn(harness.driver, "getItem");

    expect(
      clearTerminalBookingPaymentBrowserState({ driver: harness.driver }),
    ).toEqual({ status: "cleared", removed: 1 });
    expect(keys).toHaveBeenCalledTimes(4);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("fails closed after persistent verification enumeration failures", () => {
    const harness = createStorageHarness({
      [v1CheckoutKey]: "secret-checkout",
    });
    const originalKeys = harness.driver.keys.bind(harness.driver);
    let enumeration = 0;
    const keys = vi.spyOn(harness.driver, "keys").mockImplementation(() => {
      enumeration += 1;
      return enumeration === 2 || enumeration === 4
        ? {
            ok: false,
            error: { kind: "storage-unavailable", operation: "keys" },
          }
        : originalKeys();
    });
    const getItem = vi.spyOn(harness.driver, "getItem");

    expect(
      clearTerminalBookingPaymentBrowserState({ driver: harness.driver }),
    ).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "keys" },
    });
    expect(keys).toHaveBeenCalledTimes(4);
    expect(getItem).not.toHaveBeenCalled();
  });
});
