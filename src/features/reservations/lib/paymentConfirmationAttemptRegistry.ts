import { legacySessionStorageCompatibility } from "../../../platform/storage";

export type PaymentConfirmationAttemptResult =
  | "confirmed"
  | "already-confirmed";

export interface PaymentConfirmationAttemptKeyParams {
  amount: number;
  orderId: string;
  paymentKey: string;
}

const confirmedPaymentStorageKeyPrefix = "airbob:payment-confirmed:";
const inFlightAttempts = new Map<string, Promise<void>>();

const getConfirmedPaymentStorageKey = (key: string) =>
  `${confirmedPaymentStorageKeyPrefix}${key}`;

const safeGetItem = (key: string): string | null => {
  const result = legacySessionStorageCompatibility.getItem(key);
  return result.ok ? result.value : null;
};

const safeSetItem = (key: string, value: string) => {
  legacySessionStorageCompatibility.setItem(key, value);
};

const safeRemoveItem = (key: string) => {
  legacySessionStorageCompatibility.removeItem(key);
};

const hasConfirmedPaymentMarker = (key: string) =>
  safeGetItem(getConfirmedPaymentStorageKey(key)) !== null;

const markPaymentConfirmed = (key: string) => {
  safeSetItem(getConfirmedPaymentStorageKey(key), "1");
};

export const getPaymentConfirmationAttemptKey = ({
  amount,
  orderId,
  paymentKey,
}: PaymentConfirmationAttemptKeyParams) =>
  [orderId, paymentKey, String(amount)].map(encodeURIComponent).join("|");

export const runPaymentConfirmationAttempt = async (
  key: string,
  confirm: () => Promise<void>
): Promise<PaymentConfirmationAttemptResult> => {
  if (hasConfirmedPaymentMarker(key)) {
    return "already-confirmed";
  }

  const inFlightAttempt = inFlightAttempts.get(key);
  if (inFlightAttempt) {
    await inFlightAttempt;
    return "already-confirmed";
  }

  const attempt = (async () => {
    await confirm();
  })();
  inFlightAttempts.set(key, attempt);

  try {
    await attempt;
    markPaymentConfirmed(key);
    return "confirmed";
  } finally {
    inFlightAttempts.delete(key);
  }
};

export const resetPaymentConfirmationAttemptRegistryForTests = () => {
  inFlightAttempts.clear();

  const result = legacySessionStorageCompatibility.keys();
  if (!result.ok) return;
  const keys = result.value.filter((key) =>
    key.startsWith(confirmedPaymentStorageKeyPrefix)
  );

  keys.forEach(safeRemoveItem);
};
