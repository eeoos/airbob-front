import { IntegrationError, type IntegrationErrorCode } from "./errors";

export interface TossPaymentsV1Client {
  widgets: (options: { customerKey: string }) => {
    renderPaymentMethods: (
      selector: string,
      amount: { value: number },
      options: { variantKey: string },
    ) => Promise<void>;
  };
  requestPayment: (options: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerEmail: string;
    customerName: string;
    amount: number;
  }) => Promise<void>;
}

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossPaymentsV1Client;
  }
}

const TOSS_PAYMENTS_ORIGIN = "https://js.tosspayments.com";
const TOSS_PAYMENTS_PATH = "/v1";
export const TOSS_PAYMENTS_V1_SCRIPT_SRC =
  `${TOSS_PAYMENTS_ORIGIN}${TOSS_PAYMENTS_PATH}`;
const TOSS_PAYMENTS_SCRIPT_MARKER = "toss-payments-v1";
export const TOSS_PAYMENTS_READINESS_TIMEOUT_MS = 8000;

interface TossLoadAttempt {
  fail: (error: IntegrationError) => void;
  promise: Promise<void>;
  script: HTMLScriptElement;
}

let activeAttempt: TossLoadAttempt | null = null;

const unavailableError = (code: IntegrationErrorCode) =>
  new IntegrationError({
    code,
    integration: "toss-payments-v1",
    message: "결제 시스템을 불러올 수 없습니다.",
    retryable: true,
  });

const isTossPaymentsRuntimeReady = () =>
  typeof window !== "undefined" && typeof window.TossPayments === "function";

const isExactTossScript = (script: HTMLScriptElement) => {
  try {
    const url = new URL(script.src);

    return (
      url.origin === TOSS_PAYMENTS_ORIGIN &&
      url.pathname === TOSS_PAYMENTS_PATH &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
};

const getTossPaymentsScripts = () =>
  typeof document === "undefined"
    ? []
    : Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]")).filter(
        isExactTossScript,
      );

const createLoadAttempt = (script: HTMLScriptElement): TossLoadAttempt => {
  let resolvePromise!: () => void;
  let rejectPromise!: (error: IntegrationError) => void;
  let timeout: number | null = null;
  let settled = false;
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const cleanup = () => {
    script.removeEventListener("load", handleLoad);
    script.removeEventListener("error", handleError);
    if (timeout !== null) {
      window.clearTimeout(timeout);
      timeout = null;
    }
  };

  const succeed = () => {
    if (settled || !isTossPaymentsRuntimeReady()) return false;

    settled = true;
    cleanup();
    activeAttempt = null;
    resolvePromise();
    return true;
  };

  const fail = (error: IntegrationError) => {
    if (settled) return;

    settled = true;
    cleanup();
    if (script.isConnected) script.remove();
    activeAttempt = null;
    rejectPromise(error);
  };

  function handleLoad() {
    if (!succeed()) {
      fail(unavailableError("INTEGRATION_INVALID_RUNTIME"));
    }
  }

  function handleError() {
    fail(unavailableError("INTEGRATION_LOAD_FAILED"));
  }

  script.addEventListener("load", handleLoad);
  script.addEventListener("error", handleError);
  timeout = window.setTimeout(() => {
    if (!succeed()) fail(unavailableError("INTEGRATION_TIMEOUT"));
  }, TOSS_PAYMENTS_READINESS_TIMEOUT_MS);

  return { fail, promise, script };
};

export const ensureTossPaymentsV1Script = (): Promise<void> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(unavailableError("INTEGRATION_UNAVAILABLE"));
  }
  if (isTossPaymentsRuntimeReady()) {
    getTossPaymentsScripts().slice(1).forEach((script) => script.remove());
    return Promise.resolve();
  }

  if (activeAttempt) {
    if (activeAttempt.script.isConnected) {
      getTossPaymentsScripts().forEach((script) => {
        if (script !== activeAttempt?.script) script.remove();
      });
      return activeAttempt.promise;
    }

    activeAttempt.fail(unavailableError("INTEGRATION_DISCONNECTED"));
  }

  // A script not created by the active loader has no reliable completion
  // signal. Replace it instead of attaching to a possibly stale SDK instance.
  getTossPaymentsScripts().forEach((script) => script.remove());

  const script = document.createElement("script");
  script.src = TOSS_PAYMENTS_V1_SCRIPT_SRC;
  script.async = true;
  script.dataset.airbobIntegration = TOSS_PAYMENTS_SCRIPT_MARKER;

  const attempt = createLoadAttempt(script);
  activeAttempt = attempt;
  document.body.appendChild(script);

  return attempt.promise;
};

export const createTossPaymentsV1Client = (
  clientKey: string,
): TossPaymentsV1Client => {
  const normalizedClientKey = clientKey.trim();
  if (!normalizedClientKey) {
    throw new IntegrationError({
      code: "INTEGRATION_MISSING_CONFIG",
      integration: "toss-payments-v1",
      message: "Toss Payments client configuration is missing.",
      retryable: false,
    });
  }
  if (!isTossPaymentsRuntimeReady()) {
    throw unavailableError("INTEGRATION_INVALID_RUNTIME");
  }

  try {
    const client = window.TossPayments!(normalizedClientKey);
    if (
      !client ||
      typeof client.widgets !== "function" ||
      typeof client.requestPayment !== "function"
    ) {
      throw unavailableError("INTEGRATION_INVALID_RUNTIME");
    }

    return client;
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw unavailableError("INTEGRATION_INVALID_RUNTIME");
  }
};
