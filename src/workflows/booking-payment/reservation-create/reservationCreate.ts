import { isAppError } from "../../../platform/http/errors";
import type { ReservationReady } from "../../../features/reservations/public";
import { isOpaqueIdentifier } from "../../../shared/lib/opaqueIdentifier";
import {
  ReservationCreateValidationError,
  validateReservationCreateCommand,
} from "./reservationCreateValidation";
import type {
  ReservationCheckoutHandoffPreflightResult,
  ReservationCreateCommandInput,
  ReservationCreateResult,
  ReservationCreateTerminal,
  ReservationCreateWorkflow,
  ReservationCreateWorkflowDependencies,
  ValidatedReservationCreateCommand,
} from "./reservationCreateTypes";

export type {
  AppliedReservationCoupon,
  ReservationCheckoutHandoffPort,
  ReservationCreateRouteLease,
  ReservationCreateSessionPort,
  ReservationStartIntent,
} from "./reservationCreateTypes";

const isDefinitiveFailure = (error: unknown): boolean => {
  if (!isAppError(error)) return false;

  switch (error.kind) {
    case "authentication":
    case "validation":
    case "conflict":
      return true;
    case "http":
      return !error.retryable;
    default:
      return false;
  }
};

const isReady = (value: ReservationReady): boolean =>
  isOpaqueIdentifier(value.reservationUid) &&
  typeof value.orderName === "string" &&
  value.orderName.length > 0 &&
  Number.isFinite(value.amount) &&
  value.amount >= 0 &&
  typeof value.customerEmail === "string" &&
  typeof value.customerName === "string";

const freezeReady = (value: ReservationReady): ReservationReady => {
  if (!isReady(value)) {
    throw new TypeError("Reservation create response is invalid.");
  }

  return Object.freeze({
    reservationUid: value.reservationUid,
    orderName: value.orderName,
    amount: value.amount,
    customerEmail: value.customerEmail,
    customerName: value.customerName,
  });
};

const safelyCheck = (check: () => boolean): boolean => {
  try {
    return check();
  } catch {
    return false;
  }
};

export const createReservationCreateWorkflow = (
  dependencies: ReservationCreateWorkflowDependencies,
): ReservationCreateWorkflow => {
  let active: Promise<ReservationCreateResult> | null = null;
  let activeController: AbortController | null = null;
  let disposed = false;
  let terminal: ReservationCreateTerminal | null = null;

  const lockAsStale = (): ReservationCreateResult => {
    if (!disposed) terminal = "stale";
    return { status: "stale" };
  };

  const start = (
    input: ReservationCreateCommandInput,
  ): Promise<ReservationCreateResult> => {
    if (disposed) {
      return Promise.resolve({ status: "locked", terminal: "disposed" });
    }
    if (terminal) {
      return Promise.resolve({ status: "locked", terminal });
    }
    if (active) return active;

    let command: ValidatedReservationCreateCommand;
    try {
      command = validateReservationCreateCommand(input);
    } catch (error) {
      if (!safelyCheck(() => input.routeLease.isCurrent())) {
        return Promise.resolve(lockAsStale());
      }
      if (error instanceof ReservationCreateValidationError) {
        return Promise.resolve({ status: "invalid", error });
      }
      return Promise.resolve({ status: "ambiguous", error });
    }

    if (!safelyCheck(() => command.routeLease.isCurrent())) {
      return Promise.resolve(lockAsStale());
    }

    const scope = dependencies.session.captureAuthenticatedSession();
    if (scope === null) {
      if (!safelyCheck(() => command.routeLease.isCurrent())) {
        return Promise.resolve(lockAsStale());
      }
      return Promise.resolve({
        status: "auth-required",
        intent: command.intent,
      });
    }

    const isCurrent = () =>
      !disposed &&
      safelyCheck(() => command.routeLease.isCurrent()) &&
      safelyCheck(() => dependencies.session.isCurrentSession(scope));

    if (!isCurrent()) {
      return Promise.resolve(lockAsStale());
    }

    let handoffPreflight: ReservationCheckoutHandoffPreflightResult;
    try {
      handoffPreflight = dependencies.handoff.preflight({
        session: scope,
        intent: command.intent,
      });
    } catch {
      handoffPreflight = { status: "blocked" };
    }
    if (handoffPreflight.status === "payment-recovery-required") {
      return Promise.resolve({ status: "payment-recovery-required" });
    }
    if (handoffPreflight.status === "blocked") {
      return Promise.resolve({ status: "checkout-blocked" });
    }
    if (!isCurrent()) {
      return Promise.resolve(lockAsStale());
    }

    const controller = new AbortController();
    activeController = controller;

    const execute = async (): Promise<ReservationCreateResult> => {
      let createSucceeded = false;

      try {
        if (!isCurrent()) return lockAsStale();

        let sendGuard: Extract<
          ReservationCheckoutHandoffPreflightResult,
          { readonly status: "ready" | "blocked" }
        >;
        try {
          sendGuard = dependencies.handoff.assertNoNewerRecovery({
            session: scope,
            intent: command.intent,
          });
        } catch {
          sendGuard = { status: "blocked" };
        }
        if (sendGuard.status === "blocked") {
          return { status: "checkout-blocked" };
        }
        if (!isCurrent()) return lockAsStale();

        const response = await dependencies.transport.create(
          {
            accommodationId: command.intent.accommodationId,
            checkIn: command.intent.checkIn,
            checkOut: command.intent.checkOut,
            guestCount: command.intent.adultCount + command.intent.childCount,
            couponId: command.intent.couponId,
          },
          { signal: controller.signal },
        );
        createSucceeded = true;

        if (!isCurrent()) return lockAsStale();
        const reservation = freezeReady(response);
        if (!isCurrent()) return lockAsStale();

        terminal = "handed-off";
        dependencies.handoff.commit({
          session: scope,
          reservation,
          intent: command.intent,
          appliedCoupon: command.appliedCoupon,
        });

        return { status: "handed-off", reservation };
      } catch (error) {
        if (!isCurrent()) return lockAsStale();

        if (!createSucceeded && isDefinitiveFailure(error)) {
          if (!isCurrent()) return lockAsStale();
          return { status: "definitive-failure", error };
        }

        terminal = "ambiguous";
        if (!isCurrent()) return lockAsStale();
        return { status: "ambiguous", error };
      }
    };

    const pending = Promise.resolve()
      .then(execute)
      .finally(() => {
        if (active === pending) active = null;
        if (activeController === controller) activeController = null;
      });
    active = pending;
    return pending;
  };

  return {
    start,
    dispose() {
      if (disposed) return;
      disposed = true;
      terminal = "disposed";
      activeController?.abort();
    },
  };
};
