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
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Confirmation still succeeded; storage is only a same-session optimization.
  }
};

const safeRemoveItem = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Best-effort test cleanup.
  }
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

  let keys: string[];
  try {
    keys = Array.from({ length: sessionStorage.length }, (_, index) =>
      sessionStorage.key(index)
    ).filter(
      (key): key is string =>
        key !== null && key.startsWith(confirmedPaymentStorageKeyPrefix)
    );
  } catch {
    return;
  }

  keys.forEach(safeRemoveItem);
};
