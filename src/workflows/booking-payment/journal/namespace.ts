export const BOOKING_PAYMENT_V2_NAMESPACE_PREFIX = "airbob:booking-payment-v2:";

export const BOOKING_PAYMENT_V2_JOURNAL_KEY = `${BOOKING_PAYMENT_V2_NAMESPACE_PREFIX}journal`;

export const BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY = `${BOOKING_PAYMENT_V2_NAMESPACE_PREFIX}callback-credential`;

export const BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY = `${BOOKING_PAYMENT_V2_NAMESPACE_PREFIX}operation-receipt`;

const BOOKING_PAYMENT_V2_KNOWN_KEYS = Object.freeze([
  BOOKING_PAYMENT_V2_JOURNAL_KEY,
  BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
  BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
]);

const KNOWN_KEYS = new Set<string>(BOOKING_PAYMENT_V2_KNOWN_KEYS);

export const isBookingPaymentV2KnownKey = (key: string): boolean =>
  KNOWN_KEYS.has(key);

const cleanupPriority = (key: string): number => {
  if (key === BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY) return 0;
  if (key === BOOKING_PAYMENT_V2_JOURNAL_KEY) return 1;
  if (key === BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY) return 3;
  return 2;
};

/**
 * Keeps the post-Accepted barrier until every less-authoritative record has
 * been attempted. Unknown v2 keys are ordered before the receipt as well.
 */
export const orderBookingPaymentCleanupKeys = (
  keys: readonly string[],
): readonly string[] =>
  keys
    .map((key, index) => ({ key, index }))
    .sort(
      (left, right) =>
        cleanupPriority(left.key) - cleanupPriority(right.key) ||
        left.index - right.index,
    )
    .map(({ key }) => key);

export const peekBookingPaymentRecordVersion = (raw: string): number | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const version = (parsed as Record<string, unknown>).version;
    return typeof version === "number" && Number.isSafeInteger(version)
      ? version
      : null;
  } catch {
    return null;
  }
};
