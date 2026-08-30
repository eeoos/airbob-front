import { ConfigError } from "../../../platform/config/env";
import { requireTossClientKey } from "../../../platform/config/publicRuntimeConfig";
import { IntegrationError } from "../../../platform/integrations/errors";
import {
  createTossPaymentsV1Client,
  ensureTossPaymentsV1Script,
} from "../../../platform/integrations/tossPaymentsV1";

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
  if (message.includes("인증") || message.includes("Unauthorized")) {
    return new PaymentGatewayError({
      kind: "terminal",
      message:
        "Toss Payments 클라이언트 키 인증에 실패했습니다. " +
        "클라이언트 키가 올바른지 확인해주세요. " +
        "샌드박스 환경에서는 'test_ck_'로 시작하는 키를 사용해야 합니다.",
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

export const tossPaymentsV1Gateway: PaymentGatewayPort = {
  prepare: () => safely(() => ensureTossPaymentsV1Script()),

  requestPayment: (input) =>
    safely(async () => {
      await ensureTossPaymentsV1Script();
      const clientKey = requireTossClientKey();
      const client = createTossPaymentsV1Client(clientKey);
      await client.requestPayment(input);
    }),
};
