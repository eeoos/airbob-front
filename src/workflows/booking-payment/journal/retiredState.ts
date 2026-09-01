import { bookingPaymentStorageDriver } from "../../../platform/storage/bookingPaymentStorageDriver";
import type {
  SessionStorageDriver,
  StorageAccessError,
} from "../../../platform/storage/sessionStorageDriver";
import {
  BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
  orderBookingPaymentCleanupKeys,
} from "./namespace";

export const BOOKING_PAYMENT_RETIRED_STATE_PREFIXES = Object.freeze([
  "airbob:booking-payment-v1:",
  "airbob:reservation-checkout:",
  "airbob:reservation-checkout-index:",
  "airbob:payment-confirmed:",
]);

const identityCleanupPrefixes = Object.freeze([
  ...BOOKING_PAYMENT_RETIRED_STATE_PREFIXES,
  "airbob:booking-payment-v2:",
]);

export type ClearBookingPaymentBrowserStateResult =
  | { readonly status: "cleared"; readonly removed: number }
  | {
      readonly status: "partial";
      readonly removed: number;
      readonly failed: number;
    }
  | { readonly status: "storage-error"; readonly error: StorageAccessError };

interface ClearBookingPaymentBrowserStateOptions {
  readonly driver?: SessionStorageDriver;
}

const matchesAnyPrefix = (key: string, prefixes: readonly string[]): boolean =>
  prefixes.some((prefix) => key.startsWith(prefix));

const enumerateTargets = (
  driver: SessionStorageDriver,
  prefixes: readonly string[],
):
  | { readonly status: "found"; readonly keys: readonly string[] }
  | {
      readonly status: "storage-error";
      readonly error: StorageAccessError;
    } => {
  const result = driver.keys();
  if (!result.ok) return { status: "storage-error", error: result.error };

  return {
    status: "found",
    keys: result.value.filter((key) => matchesAnyPrefix(key, prefixes)),
  };
};

const removeTargets = (
  driver: SessionStorageDriver,
  keys: readonly string[],
  prefixes: readonly string[],
): void => {
  const orderedKeys = orderBookingPaymentCleanupKeys(keys);
  const includesOperationReceipt = orderedKeys.includes(
    BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
  );

  orderedKeys
    .filter((key) => key !== BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)
    .forEach((key) => {
      // Removal results are intentionally not trusted. A storage implementation
      // can report success without deleting anything, so only re-enumeration may
      // prove that a key is gone.
      driver.removeItem(key);
    });

  if (!includesOperationReceipt) return;

  // The operation receipt is the post-Accepted recovery barrier. Keep it until
  // a fresh enumeration proves that every less-authoritative key covered by
  // this cleanup is actually absent. For identity cleanup that includes v1,
  // retired-prefix, and unknown/newer v2 state.
  const verification = driver.keys();
  if (!verification.ok) return;

  const hasLowerAuthorityState = verification.value.some(
    (key) =>
      matchesAnyPrefix(key, prefixes) &&
      key !== BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
  );
  if (hasLowerAuthorityState) return;

  // Removal results are intentionally not trusted. A storage implementation
  // can report success without deleting anything, so only re-enumeration may
  // prove that a key is gone.
  driver.removeItem(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY);
};

const clearAndVerifyPrefixes = (
  driver: SessionStorageDriver,
  prefixes: readonly string[],
): ClearBookingPaymentBrowserStateResult => {
  const observedKeys = new Set<string>();

  for (let pass = 0; pass < 2; pass += 1) {
    const initial = enumerateTargets(driver, prefixes);
    if (initial.status === "storage-error") {
      if (pass === 0) continue;
      return initial;
    }
    initial.keys.forEach((key) => observedKeys.add(key));
    removeTargets(driver, initial.keys, prefixes);

    const verification = enumerateTargets(driver, prefixes);
    if (verification.status === "storage-error") {
      if (pass === 0) continue;
      return verification;
    }
    verification.keys.forEach((key) => observedKeys.add(key));

    const remainingKeys = new Set(verification.keys);
    if (remainingKeys.size === 0) {
      return { status: "cleared", removed: observedKeys.size };
    }
    if (pass === 1) {
      const removed = [...observedKeys].filter(
        (key) => !remainingKeys.has(key),
      ).length;
      return {
        status: "partial",
        removed,
        failed: remainingKeys.size,
      };
    }
  }

  throw new Error("Unreachable booking-payment cleanup state.");
};

/**
 * Clears only state owned by the active v1 terminal routes and retired builds.
 * Unresolved v2 recovery state deliberately survives this boundary.
 */
export const clearTerminalBookingPaymentBrowserState = ({
  driver = bookingPaymentStorageDriver,
}: ClearBookingPaymentBrowserStateOptions = {}): ClearBookingPaymentBrowserStateResult =>
  clearAndVerifyPrefixes(driver, BOOKING_PAYMENT_RETIRED_STATE_PREFIXES);

/**
 * Clears all booking-payment state before a new frontend identity is published.
 */
export const clearIdentityOwnedBookingPaymentBrowserState = ({
  driver = bookingPaymentStorageDriver,
}: ClearBookingPaymentBrowserStateOptions = {}): ClearBookingPaymentBrowserStateResult =>
  clearAndVerifyPrefixes(driver, identityCleanupPrefixes);
