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
interface InFlightPaymentConfirmation {
  generation: number;
  promise: Promise<void>;
}

const inFlightAttempts = new Map<string, InFlightPaymentConfirmation>();
let paymentConfirmationGeneration = 0;

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
  const capturedGeneration = paymentConfirmationGeneration;

  if (hasConfirmedPaymentMarker(key)) {
    return "already-confirmed";
  }

  const inFlightAttempt = inFlightAttempts.get(key);
  if (
    inFlightAttempt &&
    inFlightAttempt.generation === capturedGeneration
  ) {
    await inFlightAttempt.promise;
    return "already-confirmed";
  }

  const attempt = (async () => {
    await confirm();
  })();
  const entry: InFlightPaymentConfirmation = {
    generation: capturedGeneration,
    promise: attempt,
  };
  inFlightAttempts.set(key, entry);

  try {
    await attempt;
    if (paymentConfirmationGeneration === capturedGeneration) {
      markPaymentConfirmed(key);
    }
    return "confirmed";
  } finally {
    if (inFlightAttempts.get(key) === entry) {
      inFlightAttempts.delete(key);
    }
  }
};

export const clearPaymentConfirmationAttemptRegistry = () => {
  paymentConfirmationGeneration += 1;
  inFlightAttempts.clear();

  const result = legacySessionStorageCompatibility.keys();
  if (!result.ok) return;
  const keys = result.value.filter((key) =>
    key.startsWith(confirmedPaymentStorageKeyPrefix)
  );

  keys.forEach(safeRemoveItem);
};

export const resetPaymentConfirmationAttemptRegistryForTests =
  clearPaymentConfirmationAttemptRegistry;
