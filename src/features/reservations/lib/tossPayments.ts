declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossPaymentsClient;
  }
}

export interface TossPaymentsClient {
  widgets: (options: { customerKey: string }) => {
    renderPaymentMethods: (
      selector: string,
      amount: { value: number },
      options: { variantKey: string }
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

const TOSS_PAYMENTS_SCRIPT_SRC = "https://js.tosspayments.com/v1";

let tossPaymentsScriptPromise: Promise<void> | null = null;

const resolveWhenTossPaymentsIsReady = (
  script: HTMLScriptElement,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const handleLoad = () => {
      if (window.TossPayments) {
        resolve();
        return;
      }

      tossPaymentsScriptPromise = null;
      script.remove();
      reject(new Error("결제 시스템을 불러올 수 없습니다."));
    };
    const handleError = () => {
      tossPaymentsScriptPromise = null;
      script.remove();
      reject(new Error("결제 시스템을 불러올 수 없습니다."));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
  });

export const ensureTossPaymentsScript = (): Promise<void> => {
  if (window.TossPayments) {
    return Promise.resolve();
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="${TOSS_PAYMENTS_SCRIPT_SRC}"]`,
  );

  if (tossPaymentsScriptPromise) {
    if (!existingScript) {
      tossPaymentsScriptPromise = null;
    } else {
      return tossPaymentsScriptPromise;
    }
  }

  if (window.TossPayments) {
    return Promise.resolve();
  }

  const script = existingScript ?? document.createElement("script");
  script.src = TOSS_PAYMENTS_SCRIPT_SRC;
  script.async = true;

  tossPaymentsScriptPromise = resolveWhenTossPaymentsIsReady(script).catch(
    (error) => {
      tossPaymentsScriptPromise = null;
      throw error;
    },
  );

  if (!existingScript) {
    document.body.appendChild(script);
  }

  return tossPaymentsScriptPromise;
};

export const getTossClientKey = () => {
  const tossClientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;

  if (!tossClientKey) {
    throw new Error("결제 설정이 올바르지 않습니다.");
  }

  return tossClientKey;
};

export const getTossPaymentsClient = (clientKey = getTossClientKey()) => {
  if (!window.TossPayments) {
    throw new Error("결제 시스템을 불러올 수 없습니다.");
  }

  return window.TossPayments(clientKey);
};

const getTossErrorCode = (error: unknown): string => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "";
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
};

const getTossErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error !== "object" || error === null || !("message" in error)) {
    return "";
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
};

export const shouldSilentlyResetPayment = (error: unknown): boolean => {
  const errorCode = getTossErrorCode(error);
  const errorMessage = getTossErrorMessage(error);

  return (
    errorCode === "USER_CANCEL" ||
    errorMessage.includes("취소") ||
    errorMessage.includes("USER_CANCEL") ||
    errorCode === "BAD_REQUEST" ||
    errorMessage.includes("계약 후 테스트")
  );
};

export const toReservationPaymentError = (error: unknown): Error => {
  const errorMessage = getTossErrorMessage(error);

  if (errorMessage.includes("인증") || errorMessage.includes("Unauthorized")) {
    return new Error(
      "Toss Payments 클라이언트 키 인증에 실패했습니다. " +
        "클라이언트 키가 올바른지 확인해주세요. " +
        "샌드박스 환경에서는 'test_ck_'로 시작하는 키를 사용해야 합니다."
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(errorMessage || "결제 진행 중 오류가 발생했습니다.");
};
