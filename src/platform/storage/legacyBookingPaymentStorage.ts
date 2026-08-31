import {
  sessionStorageDriver,
  type SessionStorageDriver,
  type StorageAccessError,
} from "./sessionStorageDriver";

const checkoutPrefix = "airbob:reservation-checkout:";
const checkoutIndexPrefix = "airbob:reservation-checkout-index:";
const confirmedPaymentPrefix = "airbob:payment-confirmed:";

const legacyPrefixes = [
  checkoutPrefix,
  checkoutIndexPrefix,
  confirmedPaymentPrefix,
] as const;

const isPositiveSafeInteger = (value: number) =>
  Number.isSafeInteger(value) && value > 0;

const isBoundedIdentifier = (value: string, maxLength = 512) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maxLength &&
  value.trim() === value;

export type LegacyBookingPaymentReadResult =
  | { readonly status: "found"; readonly raw: string }
  | { readonly status: "missing" }
  | { readonly status: "invalid-key" }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

export type LegacyBookingPaymentCleanupResult =
  | { readonly status: "cleared"; readonly removed: number }
  | {
      readonly status: "partial";
      readonly removed: number;
      readonly failed: number;
    }
  | { readonly status: "invalid-key" }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

export type LegacyPaymentConfirmedHintResult =
  | { readonly status: "hint"; readonly shouldReconcile: boolean }
  | { readonly status: "invalid-key" }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

export interface LegacyPaymentMarkerTuple {
  readonly orderId: string;
  readonly paymentKey: string;
  readonly amount: number;
}

export interface LegacyBookingPaymentStorage {
  readCheckout(accommodationId: number): LegacyBookingPaymentReadResult;
  readCheckoutIndex(reservationUid: string): LegacyBookingPaymentReadResult;
  clearCheckoutPrimary(
    accommodationId: number,
  ): LegacyBookingPaymentCleanupResult;
  clearCheckoutIndex(reservationUid: string): LegacyBookingPaymentCleanupResult;
  clearCheckout(
    accommodationId: number,
    reservationUid: string,
  ): LegacyBookingPaymentCleanupResult;
  consumeConfirmedPaymentHint(
    tuple: LegacyPaymentMarkerTuple,
  ): LegacyPaymentConfirmedHintResult;
  clearAll(): LegacyBookingPaymentCleanupResult;
}

const checkoutKey = (accommodationId: number) =>
  `${checkoutPrefix}${accommodationId}`;

const checkoutIndexKey = (reservationUid: string) =>
  `${checkoutIndexPrefix}${reservationUid}`;

const confirmationAttemptKey = ({
  amount,
  orderId,
  paymentKey,
}: LegacyPaymentMarkerTuple) =>
  [orderId, paymentKey, String(amount)].map(encodeURIComponent).join("|");

const confirmedPaymentKey = (tuple: LegacyPaymentMarkerTuple) =>
  `${confirmedPaymentPrefix}${confirmationAttemptKey(tuple)}`;

const removeKeys = (
  driver: SessionStorageDriver,
  keys: readonly string[],
): LegacyBookingPaymentCleanupResult => {
  const uniqueKeys = Array.from(new Set(keys));
  const outcomes = uniqueKeys.map((key) => driver.removeItem(key));
  const removed = outcomes.filter((outcome) => outcome.ok).length;
  const failed = outcomes.length - removed;

  return failed === 0
    ? { status: "cleared", removed }
    : { status: "partial", removed, failed };
};

export const createLegacyBookingPaymentStorage = (
  driver: SessionStorageDriver = sessionStorageDriver,
): LegacyBookingPaymentStorage => {
  const readExactKey = (key: string): LegacyBookingPaymentReadResult => {
    const result = driver.getItem(key);
    if (!result.ok) return { status: "storage-error", error: result.error };

    return result.value === null
      ? { status: "missing" }
      : { status: "found", raw: result.value };
  };

  return {
    readCheckout(accommodationId) {
      if (!isPositiveSafeInteger(accommodationId)) {
        return { status: "invalid-key" };
      }

      return readExactKey(checkoutKey(accommodationId));
    },

    readCheckoutIndex(reservationUid) {
      if (!isBoundedIdentifier(reservationUid, 128)) {
        return { status: "invalid-key" };
      }

      return readExactKey(checkoutIndexKey(reservationUid));
    },

    clearCheckoutPrimary(accommodationId) {
      if (!isPositiveSafeInteger(accommodationId)) {
        return { status: "invalid-key" };
      }

      return removeKeys(driver, [checkoutKey(accommodationId)]);
    },

    clearCheckoutIndex(reservationUid) {
      if (!isBoundedIdentifier(reservationUid, 128)) {
        return { status: "invalid-key" };
      }

      return removeKeys(driver, [checkoutIndexKey(reservationUid)]);
    },

    clearCheckout(accommodationId, reservationUid) {
      if (
        !isPositiveSafeInteger(accommodationId) ||
        !isBoundedIdentifier(reservationUid, 128)
      ) {
        return { status: "invalid-key" };
      }

      return removeKeys(driver, [
        checkoutKey(accommodationId),
        checkoutIndexKey(reservationUid),
      ]);
    },

    consumeConfirmedPaymentHint(tuple) {
      if (
        !isBoundedIdentifier(tuple.orderId, 128) ||
        !isBoundedIdentifier(tuple.paymentKey) ||
        !isPositiveSafeInteger(tuple.amount)
      ) {
        return { status: "invalid-key" };
      }

      const key = confirmedPaymentKey(tuple);
      const stored = driver.getItem(key);
      if (!stored.ok) {
        return { status: "storage-error", error: stored.error };
      }

      if (stored.value === null) {
        return { status: "hint", shouldReconcile: false };
      }

      const cleanup = driver.removeItem(key);
      if (!cleanup.ok) {
        return { status: "storage-error", error: cleanup.error };
      }

      // This marker was only ever a same-tab optimization. Its presence is an
      // instruction to reconcile with the server, never proof of confirmation.
      return { status: "hint", shouldReconcile: true };
    },

    clearAll() {
      const keys = driver.keys();
      if (!keys.ok) return { status: "storage-error", error: keys.error };

      return removeKeys(
        driver,
        keys.value.filter((key) =>
          legacyPrefixes.some((prefix) => key.startsWith(prefix)),
        ),
      );
    },
  };
};
