import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import {
  PaymentGatewayError,
  type PaymentGatewayPort,
  type PaymentGatewayRequest,
} from "./paymentGateway";

export interface PaymentRequestRouteLease {
  isCurrent(): boolean;
}

export interface PaymentRequestSessionPort {
  captureAuthenticatedSession(): AuthenticatedSessionScope | null;
  isCurrentSession(scope: AuthenticatedSessionScope): boolean;
}

export interface PaymentRequestCommand extends PaymentGatewayRequest {
  readonly reservationUid: string;
  readonly routeLease: PaymentRequestRouteLease;
}

export type PaymentRequestTerminal =
  | "requested"
  | "terminal-failure"
  | "stale"
  | "disposed";

export type PaymentRequestResult =
  | { readonly status: "ready" }
  | { readonly status: "requested" }
  | { readonly status: "invalid" }
  | { readonly status: "stale" }
  | { readonly status: "cancelled"; readonly error: PaymentGatewayError }
  | { readonly status: "retryable-error"; readonly error: PaymentGatewayError }
  | { readonly status: "terminal-failure"; readonly error: PaymentGatewayError }
  | { readonly status: "locked"; readonly terminal: PaymentRequestTerminal };

export interface PaymentRequestWorkflow {
  prepare(input: {
    readonly routeLease: PaymentRequestRouteLease;
  }): Promise<PaymentRequestResult>;
  request(input: PaymentRequestCommand): Promise<PaymentRequestResult>;
  dispose(): void;
}

export interface PaymentRequestWorkflowDependencies {
  readonly gateway: PaymentGatewayPort;
  readonly session: PaymentRequestSessionPort;
}

const isBoundedText = (value: string, maxLength: number): boolean => {
  const length = value.trim().length;
  return length > 0 && length <= maxLength && value.trim() === value;
};

const isHttpsUrl = (value: string): boolean => {
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

const isValidCommand = (input: PaymentRequestCommand): boolean =>
  isBoundedText(input.reservationUid, 128) &&
  isBoundedText(input.orderId, 128) &&
  input.orderId === input.reservationUid &&
  isBoundedText(input.orderName, 256) &&
  Number.isSafeInteger(input.amount) &&
  input.amount > 0 &&
  isBoundedText(input.customerEmail, 320) &&
  isBoundedText(input.customerName, 128) &&
  isHttpsUrl(input.successUrl) &&
  isHttpsUrl(input.failUrl);

const safeCheck = (check: () => boolean): boolean => {
  try {
    return check();
  } catch {
    return false;
  }
};

const toSafeGatewayError = (error: unknown): PaymentGatewayError =>
  error instanceof PaymentGatewayError
    ? error
    : new PaymentGatewayError({
        kind: "recoverable",
        message: "결제 진행 중 오류가 발생했습니다.",
      });

export const createPaymentRequestWorkflow = ({
  gateway,
  session,
}: PaymentRequestWorkflowDependencies): PaymentRequestWorkflow => {
  let active: Promise<PaymentRequestResult> | null = null;
  let terminal: PaymentRequestTerminal | null = null;
  let disposed = false;

  const execute = (
    kind: "prepare" | "request",
    input: { readonly routeLease: PaymentRequestRouteLease } | PaymentRequestCommand,
  ): Promise<PaymentRequestResult> => {
    if (disposed) {
      return Promise.resolve({ status: "locked", terminal: "disposed" });
    }
    if (terminal) return Promise.resolve({ status: "locked", terminal });
    if (active) return active;
    if (kind === "request" && !isValidCommand(input as PaymentRequestCommand)) {
      return Promise.resolve({ status: "invalid" });
    }
    if (!safeCheck(() => input.routeLease.isCurrent())) {
      terminal = "stale";
      return Promise.resolve({ status: "stale" });
    }

    const scope = session.captureAuthenticatedSession();
    if (scope === null) {
      terminal = "stale";
      return Promise.resolve({ status: "stale" });
    }
    const isCurrent = () =>
      !disposed &&
      safeCheck(() => input.routeLease.isCurrent()) &&
      safeCheck(() => session.isCurrentSession(scope));

    const run = async (): Promise<PaymentRequestResult> => {
      if (!isCurrent()) {
        terminal = "stale";
        return { status: "stale" };
      }

      try {
        if (kind === "prepare") await gateway.prepare();
        else await gateway.requestPayment(input as PaymentRequestCommand);
        if (!isCurrent()) {
          terminal = "stale";
          return { status: "stale" };
        }
        if (kind === "prepare") return { status: "ready" };

        terminal = "requested";
        return { status: "requested" };
      } catch (error) {
        if (!isCurrent()) {
          terminal = "stale";
          return { status: "stale" };
        }
        const safeError = toSafeGatewayError(error);
        if (safeError.kind === "cancelled") {
          return { status: "cancelled", error: safeError };
        }
        if (safeError.kind === "recoverable") {
          return { status: "retryable-error", error: safeError };
        }

        terminal = "terminal-failure";
        return { status: "terminal-failure", error: safeError };
      }
    };

    const pending = Promise.resolve()
      .then(run)
      .finally(() => {
        if (active === pending) active = null;
      });
    active = pending;
    return pending;
  };

  return {
    prepare: (input) => execute("prepare", input),
    request: (input) => execute("request", input),
    dispose() {
      if (disposed) return;
      disposed = true;
      terminal = "disposed";
    },
  };
};
