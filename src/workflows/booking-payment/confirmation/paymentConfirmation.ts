import type {
  CheckoutOwnership,
  CheckoutOwnershipApiPort,
  PaymentApiPort,
  PaymentRecord,
  PaymentStatus,
} from "../../../features/reservations/payment/public";
import { isAppError } from "../../../platform/http/errors";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { isOpaqueIdentifier } from "../../../shared/lib/opaqueIdentifier";

export interface PaymentConfirmationRouteLease {
  isCurrent(): boolean;
}

export interface PaymentConfirmationSessionPort {
  captureAuthenticatedSession(): AuthenticatedSessionScope | null;
  isCurrentSession(scope: AuthenticatedSessionScope): boolean;
}

export interface PaymentConfirmationOwnershipClaim {
  readonly operationId: string;
  readonly accommodationId: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestCount: number;
}

export interface PaymentConfirmationCommand {
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentKey: string;
  readonly amount: number;
  readonly ownership: PaymentConfirmationOwnershipClaim;
  readonly routeLease: PaymentConfirmationRouteLease;
  /**
   * Persists the point after ownership verification where a confirm POST may
   * be attempted. Returning false (or throwing) fails closed before network I/O.
   */
  readonly markConfirming: () => boolean;
}

export type PaymentConfirmationTerminal =
  | "confirmed"
  | "invalid"
  | "terminal-failure"
  | "stale"
  | "disposed";

export type PaymentConfirmationResult =
  | { readonly status: "confirmed" }
  | { readonly status: "pending" }
  | { readonly status: "invalid" }
  | { readonly status: "stale" }
  | { readonly status: "preflight-retryable-error"; readonly error: unknown }
  | { readonly status: "retryable-error"; readonly error: unknown }
  | { readonly status: "terminal-failure"; readonly error?: unknown }
  | {
      readonly status: "locked";
      readonly terminal: PaymentConfirmationTerminal;
    };

export interface PaymentConfirmationWorkflow {
  confirm(input: PaymentConfirmationCommand): Promise<PaymentConfirmationResult>;
  reconcile(
    input: PaymentConfirmationCommand,
  ): Promise<PaymentConfirmationResult>;
  dispose(): void;
}

export interface PaymentConfirmationWorkflowDependencies {
  readonly api: PaymentApiPort;
  readonly ownershipApi: CheckoutOwnershipApiPort;
  readonly session: PaymentConfirmationSessionPort;
}

type OperationKind = "confirm" | "reconcile";

interface ActiveDescriptor {
  readonly kind: OperationKind;
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentKey: string;
  readonly amount: number;
  readonly operationId: string;
  readonly accommodationId: number;
}

const pendingStatuses = new Set<PaymentStatus>([
  "READY",
  "IN_PROGRESS",
  "WAITING_FOR_DEPOSIT",
]);
const terminalFailureStatuses = new Set<PaymentStatus>([
  "CANCELED",
  "PARTIAL_CANCELED",
  "ABORTED",
  "EXPIRED",
]);

const isBoundedText = (value: string, maximumLength: number): boolean => {
  const length = value.trim().length;
  return length > 0 && length <= maximumLength && value.trim() === value;
};

const isCalendarDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const isValidCommand = (input: PaymentConfirmationCommand): boolean =>
  isOpaqueIdentifier(input.reservationUid) &&
  isOpaqueIdentifier(input.orderId) &&
  isBoundedText(input.paymentKey, 512) &&
  input.orderId === input.reservationUid &&
  Number.isSafeInteger(input.amount) &&
  input.amount > 0 &&
  /^[A-Za-z0-9_-]{1,128}$/.test(input.ownership.operationId) &&
  Number.isSafeInteger(input.ownership.accommodationId) &&
  input.ownership.accommodationId > 0 &&
  isCalendarDate(input.ownership.checkIn) &&
  isCalendarDate(input.ownership.checkOut) &&
  input.ownership.checkIn < input.ownership.checkOut &&
  Number.isSafeInteger(input.ownership.guestCount) &&
  input.ownership.guestCount > 0 &&
  typeof input.markConfirming === "function";

const safelyCheck = (check: () => boolean): boolean => {
  try {
    return check();
  } catch {
    return false;
  }
};

const isDefinitiveFailure = (error: unknown): boolean => {
  if (error instanceof TypeError) return true;
  if (!isAppError(error)) return false;

  switch (error.kind) {
    case "authentication":
    case "validation":
      return true;
    case "conflict":
      return false;
    case "http":
      return !error.retryable;
    default:
      return false;
  }
};

const paymentTupleMatches = (
  payment: PaymentRecord,
  input: PaymentConfirmationCommand,
): boolean =>
  payment.orderId === input.orderId &&
  payment.totalAmount === input.amount &&
  payment.paymentKey === input.paymentKey;

const paymentOrderMatches = (
  payment: PaymentRecord,
  input: PaymentConfirmationCommand,
): boolean =>
  payment.orderId === input.orderId && payment.totalAmount === input.amount;

const toStatusResult = (
  payment: PaymentRecord,
  input: PaymentConfirmationCommand,
): PaymentConfirmationResult => {
  if (!paymentTupleMatches(payment, input)) return { status: "invalid" };
  if (payment.status === "DONE") return { status: "confirmed" };
  if (pendingStatuses.has(payment.status)) return { status: "pending" };
  if (terminalFailureStatuses.has(payment.status)) {
    return { status: "terminal-failure" };
  }

  return { status: "invalid" };
};

const ownershipMatches = (
  ownership: CheckoutOwnership,
  input: PaymentConfirmationCommand,
): boolean =>
  ownership.reservationUid === input.reservationUid &&
  ownership.accommodationId === input.ownership.accommodationId &&
  ownership.checkIn === input.ownership.checkIn &&
  ownership.checkOut === input.ownership.checkOut &&
  ownership.guestCount === input.ownership.guestCount &&
  (ownership.payment === null || paymentOrderMatches(ownership.payment, input)) &&
  (ownership.payment?.paymentKey === null ||
    ownership.payment?.paymentKey === undefined ||
    ownership.payment.paymentKey === input.paymentKey);

const descriptorOf = (
  kind: OperationKind,
  input: PaymentConfirmationCommand,
): ActiveDescriptor => ({
  kind,
  reservationUid: input.reservationUid,
  orderId: input.orderId,
  paymentKey: input.paymentKey,
  amount: input.amount,
  operationId: input.ownership.operationId,
  accommodationId: input.ownership.accommodationId,
});

const sameDescriptor = (
  left: ActiveDescriptor,
  right: ActiveDescriptor,
): boolean =>
  left.kind === right.kind &&
  left.reservationUid === right.reservationUid &&
  left.orderId === right.orderId &&
  left.paymentKey === right.paymentKey &&
  left.amount === right.amount &&
  left.operationId === right.operationId &&
  left.accommodationId === right.accommodationId;

export const createPaymentConfirmationWorkflow = ({
  api,
  ownershipApi,
  session,
}: PaymentConfirmationWorkflowDependencies): PaymentConfirmationWorkflow => {
  let active: {
    readonly descriptor: ActiveDescriptor;
    readonly promise: Promise<PaymentConfirmationResult>;
  } | null = null;
  let activeController: AbortController | null = null;
  let confirmationAttempted = false;
  let disposed = false;
  let terminal: PaymentConfirmationTerminal | null = null;

  const lock = (
    nextTerminal: Exclude<PaymentConfirmationTerminal, "disposed">,
    result: PaymentConfirmationResult,
  ): PaymentConfirmationResult => {
    if (!disposed) terminal = nextTerminal;
    return result;
  };

  const lockResult = (
    result: PaymentConfirmationResult,
  ): PaymentConfirmationResult => {
    switch (result.status) {
      case "confirmed":
        return lock("confirmed", result);
      case "invalid":
        return lock("invalid", result);
      case "terminal-failure":
        return lock("terminal-failure", result);
      case "stale":
        return lock("stale", result);
      default:
        return result;
    }
  };

  const execute = (
    requestedKind: OperationKind,
    input: PaymentConfirmationCommand,
  ): Promise<PaymentConfirmationResult> => {
    if (disposed) {
      return Promise.resolve({ status: "locked", terminal: "disposed" });
    }
    if (terminal) {
      return Promise.resolve({ status: "locked", terminal });
    }

    const kind: OperationKind =
      requestedKind === "confirm" && confirmationAttempted
        ? "reconcile"
        : requestedKind;
    const descriptor = descriptorOf(kind, input);
    if (active) {
      return sameDescriptor(active.descriptor, descriptor)
        ? active.promise
        : Promise.resolve({ status: "invalid" });
    }
    if (!isValidCommand(input)) {
      return Promise.resolve(lock("invalid", { status: "invalid" }));
    }
    if (!safelyCheck(() => input.routeLease.isCurrent())) {
      return Promise.resolve(lock("stale", { status: "stale" }));
    }

    const scope = session.captureAuthenticatedSession();
    if (scope === null) {
      return Promise.resolve(lock("stale", { status: "stale" }));
    }
    const controller = new AbortController();
    activeController = controller;
    const isCurrent = () =>
      !disposed &&
      safelyCheck(() => input.routeLease.isCurrent()) &&
      safelyCheck(() => session.isCurrentSession(scope));

    const reconcile = async (): Promise<PaymentConfirmationResult> => {
      try {
        const payment = await api.getByPaymentKey(input.paymentKey, {
          signal: controller.signal,
        });
        if (!isCurrent()) return lock("stale", { status: "stale" });
        return lockResult(toStatusResult(payment, input));
      } catch (error) {
        if (!isCurrent()) return lock("stale", { status: "stale" });
        if (isDefinitiveFailure(error)) {
          return lock("terminal-failure", {
            status: "terminal-failure",
            error,
          });
        }
        return { status: "retryable-error", error };
      }
    };

    const verifyOwnership = async (): Promise<
      | { readonly status: "owned"; readonly value: CheckoutOwnership }
      | PaymentConfirmationResult
    > => {
      try {
        const ownership = await ownershipApi.getCheckoutOwnership(
          input.reservationUid,
          { signal: controller.signal },
        );
        if (!isCurrent()) return lock("stale", { status: "stale" });
        if (!ownershipMatches(ownership, input)) {
          return lock("invalid", { status: "invalid" });
        }
        return { status: "owned", value: ownership };
      } catch (error) {
        if (!isCurrent()) return lock("stale", { status: "stale" });
        if (isDefinitiveFailure(error)) {
          return lock("terminal-failure", {
            status: "terminal-failure",
            error,
          });
        }
        return { status: "preflight-retryable-error", error };
      }
    };

    const run = async (): Promise<PaymentConfirmationResult> => {
      if (!isCurrent()) return lock("stale", { status: "stale" });

      const ownership = await verifyOwnership();
      if (ownership.status !== "owned") return ownership;

      const ownedPayment = ownership.value.payment;
      if (
        ownedPayment?.paymentKey === input.paymentKey &&
        ownedPayment.status === "DONE"
      ) {
        return lock("confirmed", { status: "confirmed" });
      }
      if (
        ownedPayment?.paymentKey === input.paymentKey &&
        terminalFailureStatuses.has(ownedPayment.status)
      ) {
        return lock("terminal-failure", { status: "terminal-failure" });
      }
      if (kind === "reconcile") return reconcile();

      if (!safelyCheck(input.markConfirming)) {
        return lock("invalid", { status: "invalid" });
      }
      confirmationAttempted = true;
      try {
        await api.confirm(
          {
            amount: input.amount,
            orderId: input.orderId,
            paymentKey: input.paymentKey,
          },
          { signal: controller.signal },
        );
        if (!isCurrent()) return lock("stale", { status: "stale" });
        return lock("confirmed", { status: "confirmed" });
      } catch (error) {
        if (!isCurrent()) return lock("stale", { status: "stale" });
        if (isDefinitiveFailure(error)) {
          return lock("terminal-failure", {
            status: "terminal-failure",
            error,
          });
        }
        return reconcile();
      }
    };

    const pending = Promise.resolve()
      .then(run)
      .finally(() => {
        if (active?.promise === pending) active = null;
        if (activeController === controller) activeController = null;
      });
    active = { descriptor, promise: pending };
    return pending;
  };

  return {
    confirm: (input) => execute("confirm", input),
    reconcile: (input) => execute("reconcile", input),
    dispose() {
      if (disposed) return;
      disposed = true;
      terminal = "disposed";
      activeController?.abort();
    },
  };
};
