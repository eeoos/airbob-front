import { ConfigError } from "../../../platform/config/env";
import { requireTossClientKey } from "../../../platform/config/publicRuntimeConfig";
import { IntegrationError } from "../../../platform/integrations/errors";
import {
  loadTossPaymentsV2Client,
} from "../../../platform/integrations/tossPaymentsV2";

export interface PaymentGatewayRequest {
  readonly orderId: string;
  readonly orderName: string;
  readonly successUrl: string;
  readonly failUrl: string;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly amount: number;
}

export interface PaymentGatewayPort {
  prepare(): Promise<void>;
  requestPayment(input: PaymentGatewayRequest): Promise<void>;
}

export interface PaymentGatewayLease {
  readonly gateway: PaymentGatewayPort;
  dispose(): void;
}

export type PaymentGatewayFailureKind =
  | "cancelled"
  | "recoverable"
  | "terminal";

export class PaymentGatewayError extends Error {
  readonly kind: PaymentGatewayFailureKind;
  readonly silent: boolean;

  constructor({
    kind,
    message,
    silent = false,
  }: {
    readonly kind: PaymentGatewayFailureKind;
    readonly message: string;
    readonly silent?: boolean;
  }) {
    super(message);
    this.name = "PaymentGatewayError";
    this.kind = kind;
    this.silent = silent;
    Object.setPrototypeOf(this, PaymentGatewayError.prototype);
  }
}

const readProviderText = (error: unknown, key: "code" | "message") => {
  if (error instanceof Error && key === "message") return error.message;
  if (typeof error !== "object" || error === null || !(key in error)) {
    return "";
  }

  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
};

const clientConfigurationErrorCodes = new Set([
  "INSECURE_KEY_USAGE",
  "INVALID_CLIENT_KEY",
  "NOT_SUPPORTED_API_INDIVIDUAL_KEY",
  "NOT_SUPPORTED_WIDGET_KEY",
]);

const requestContractErrorCodes = new Set([
  "BELOW_ZERO_AMOUNT",
  "INCORRECT_FAIL_URL_FORMAT",
  "INCORRECT_SUCCESS_URL_FORMAT",
  "INVALID_AMOUNT_CURRENCY",
  "INVALID_AMOUNT_VALUE",
  "INVALID_CUSTOMER_KEY",
  "INVALID_METADATA",
  "INVALID_PARAMETERS",
  "NOT_SUPPORTED_METHOD",
  "NOT_SUPPORTED_PROMISE",
  "V1_METHOD_NOT_SUPPORTED",
]);

const normalizeGatewayFailure = (error: unknown): PaymentGatewayError => {
  if (error instanceof PaymentGatewayError) return error;

  const code = readProviderText(error, "code");
  const message = readProviderText(error, "message");
  if (
    code === "USER_CANCEL" ||
    message.includes("취소") ||
    message.includes("USER_CANCEL")
  ) {
    return new PaymentGatewayError({
      kind: "cancelled",
      message: "결제가 취소되었습니다.",
      silent: true,
    });
  }
  if (
    code === "BAD_REQUEST" ||
    message.includes("계약 후 테스트")
  ) {
    return new PaymentGatewayError({
      kind: "recoverable",
      message: "결제 요청을 다시 시도해주세요.",
      silent: true,
    });
  }
  if (
    clientConfigurationErrorCodes.has(code) ||
    message.includes("인증") ||
    message.includes("Unauthorized")
  ) {
    return new PaymentGatewayError({
      kind: "terminal",
      message:
        "Toss Payments 클라이언트 키 인증에 실패했습니다. " +
        "클라이언트 키가 올바른지 확인해주세요. " +
        "샌드박스 환경에서는 'test_ck_'로 시작하는 키를 사용해야 합니다.",
    });
  }
  if (requestContractErrorCodes.has(code)) {
    return new PaymentGatewayError({
      kind: "terminal",
      message: "결제 요청 정보가 올바르지 않습니다.",
    });
  }
  if (error instanceof ConfigError) {
    return new PaymentGatewayError({
      kind: "terminal",
      message: "결제 설정이 올바르지 않습니다.",
    });
  }
  if (error instanceof IntegrationError) {
    return new PaymentGatewayError({
      kind: error.retryable ? "recoverable" : "terminal",
      message: "결제 시스템을 불러올 수 없습니다.",
    });
  }

  return new PaymentGatewayError({
    kind: "recoverable",
    message: "결제 진행 중 오류가 발생했습니다.",
  });
};

const safely = async (operation: () => Promise<void>): Promise<void> => {
  try {
    await operation();
  } catch (error) {
    throw normalizeGatewayFailure(error);
  }
};

export const createTossPaymentsV2GatewayLease = (): PaymentGatewayLease => {
  let clientPromise: ReturnType<typeof loadTossPaymentsV2Client> | null = null;

  const loadConfiguredClient = () => {
    if (clientPromise) return clientPromise;

    const pending = Promise.resolve()
      .then(() => loadTossPaymentsV2Client(requireTossClientKey()))
      .catch((error: unknown) => {
        if (clientPromise === pending) clientPromise = null;
        throw error;
      });
    clientPromise = pending;
    return pending;
  };

  const gateway: PaymentGatewayPort = {
    prepare: () =>
      safely(async () => {
        await loadConfiguredClient();
      }),

    requestPayment: (input) =>
      safely(async () => {
        const client = await loadConfiguredClient();
        await client.requestPayment(input);
      }),
  };

  return {
    gateway,
    dispose() {
      const retiringClient = clientPromise;
      clientPromise = null;
      if (!retiringClient) return;

      void retiringClient
        .then((client) => client.dispose())
        .catch(() => undefined);
    },
  };
};
