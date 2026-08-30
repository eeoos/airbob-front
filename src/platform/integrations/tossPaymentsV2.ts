import {
  ANONYMOUS,
  clearTossPayments,
  loadTossPayments,
  type TossPaymentsSDK,
} from "@tosspayments/tosspayments-sdk";
import { IntegrationError, type IntegrationErrorCode } from "./errors";

export interface TossPaymentsV2Request {
  readonly orderId: string;
  readonly orderName: string;
  readonly successUrl: string;
  readonly failUrl: string;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly amount: number;
}

export interface TossPaymentsV2Client {
  requestPayment(input: TossPaymentsV2Request): Promise<void>;
  dispose(): Promise<void>;
}

export const TOSS_PAYMENTS_V2_READINESS_TIMEOUT_MS = 8000;

const sdkLoads = new Map<string, Promise<TossPaymentsSDK>>();

class TossPaymentsV2RequestError extends Error {
  readonly code = "INVALID_PARAMETERS";

  constructor() {
    super("The payment request does not satisfy the Toss v2 contract.");
    this.name = "TossPaymentsV2RequestError";
    Object.setPrototypeOf(this, TossPaymentsV2RequestError.prototype);
  }
}

const unavailableError = (code: IntegrationErrorCode) =>
  new IntegrationError({
    code,
    integration: "toss-payments-v2",
    message: "결제 시스템을 불러올 수 없습니다.",
    retryable: code !== "INTEGRATION_MISSING_CONFIG",
  });

const readErrorName = (error: unknown): string => {
  if (error instanceof Error) return error.name;
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return "";
  }

  const name = (error as Record<string, unknown>).name;
  return typeof name === "string" ? name : "";
};

const readErrorCode = (error: unknown): string => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "";
  }

  const code = (error as Record<string, unknown>).code;
  return typeof code === "string" ? code : "";
};

const isSdkBootstrapFailure = (error: unknown): boolean => {
  const name = readErrorName(error);
  return (
    name === "ScriptLoadFailedError" ||
    name === "NamespaceNotAvailableError"
  );
};

const isBoundedText = (value: string, maxLength: number): boolean =>
  value.length > 0 && value.length <= maxLength && value.trim() === value;

const isAbsoluteRedirectUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    const isLoopback =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    return url.protocol === "https:" || (url.protocol === "http:" && isLoopback);
  } catch {
    return false;
  }
};

const isValidRequest = (input: TossPaymentsV2Request): boolean =>
  /^[A-Za-z0-9_=-]{6,64}$/.test(input.orderId) &&
  isBoundedText(input.orderName, 100) &&
  isBoundedText(input.customerEmail, 100) &&
  isBoundedText(input.customerName, 100) &&
  Number.isSafeInteger(input.amount) &&
  input.amount > 0 &&
  isAbsoluteRedirectUrl(input.successUrl) &&
  isAbsoluteRedirectUrl(input.failUrl);

const resetSdkRuntime = (): void => {
  sdkLoads.clear();
  try {
    clearTossPayments();
  } catch {
    // A provider cleanup failure must not keep readiness or disposal pending.
  }
};

const withReadinessTimeout = <T,>(operation: Promise<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resetSdkRuntime();
      reject(unavailableError("INTEGRATION_TIMEOUT"));
    }, TOSS_PAYMENTS_V2_READINESS_TIMEOUT_MS);

    operation.then(
      (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });

const loadSdk = (clientKey: string): Promise<TossPaymentsSDK> => {
  const existing = sdkLoads.get(clientKey);
  if (existing) return existing;

  const pending = withReadinessTimeout(loadTossPayments(clientKey)).catch(
    (error: unknown) => {
      if (sdkLoads.get(clientKey) === pending) {
        sdkLoads.delete(clientKey);
      }
      if (isSdkBootstrapFailure(error)) {
        throw unavailableError("INTEGRATION_LOAD_FAILED");
      }
      throw error;
    },
  );
  sdkLoads.set(clientKey, pending);
  return pending;
};

const createClient = async (clientKey: string): Promise<TossPaymentsV2Client> => {
  try {
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw unavailableError("INTEGRATION_UNAVAILABLE");
    }

    const sdk = await loadSdk(clientKey);
    if (!sdk || typeof sdk.payment !== "function") {
      resetSdkRuntime();
      throw unavailableError("INTEGRATION_INVALID_RUNTIME");
    }

    const payment = sdk.payment({ customerKey: ANONYMOUS });
    if (
      !payment ||
      typeof payment.requestPayment !== "function" ||
      typeof payment.destroy !== "function"
    ) {
      resetSdkRuntime();
      throw unavailableError("INTEGRATION_INVALID_RUNTIME");
    }

    let disposed = false;

    return {
      requestPayment: (input) => {
        if (disposed) {
          return Promise.reject(
            Object.assign(new Error("The payment client was disposed."), {
              code: "PAYMENT_REQUEST_ABORTED",
            }),
          );
        }
        if (!isValidRequest(input)) {
          return Promise.reject(new TossPaymentsV2RequestError());
        }

        return payment.requestPayment({
          method: "CARD",
          amount: { currency: "KRW", value: input.amount },
          orderId: input.orderId,
          orderName: input.orderName,
          successUrl: input.successUrl,
          failUrl: input.failUrl,
          customerEmail: input.customerEmail,
          customerName: input.customerName,
        });
      },
      async dispose() {
        if (disposed) return;
        disposed = true;
        try {
          await payment.destroy();
        } catch (error) {
          if (readErrorCode(error) !== "NO_ACTIVE_PAYMENT_REQUEST") {
            throw error;
          }
        }
      },
    };
  } catch (error) {
    if (error instanceof IntegrationError) throw error;

    // Provider request/configuration failures keep their code and message so
    // the gateway can normalize them without exposing the provider object.
    throw error;
  }
};

export const loadTossPaymentsV2Client = (
  clientKey: string,
): Promise<TossPaymentsV2Client> => {
  const normalizedClientKey = clientKey.trim();
  if (!normalizedClientKey) {
    return Promise.reject(unavailableError("INTEGRATION_MISSING_CONFIG"));
  }

  return createClient(normalizedClientKey);
};
