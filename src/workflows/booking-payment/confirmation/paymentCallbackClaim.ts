import type {
  CheckoutOwnership,
  CheckoutOwnershipApiPort,
} from "../../../features/reservations/payment/public";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { isOpaqueIdentifier } from "../../../shared/lib/opaqueIdentifier";
import type {
  BookingPaymentOperationId,
  CallbackData,
  CallbackRepository,
  CheckoutData,
  CheckoutRepository,
} from "../checkout";

export interface PaymentCallbackFreshTuple {
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentKey: string;
  readonly amount: number;
}

export interface PaymentCallbackDocument {
  readonly operationId: BookingPaymentOperationId;
  readonly reservationUid: string;
  readonly amount: number;
  readonly accommodationId: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestCount: number;
}

export interface PaymentCallbackReady {
  readonly status: "ready";
  readonly callback: CallbackData;
  readonly document: PaymentCallbackDocument;
  readonly persistCallback: boolean;
  readonly shouldConfirm: boolean;
}

export type PaymentCallbackClaimInvalidReason =
  | "invalid-fresh-tuple"
  | "checkout-unavailable"
  | "callback-unavailable"
  | "callback-mismatch"
  | "missing-callback"
  | "marker-unavailable"
  | "callback-write-failed";

export type PaymentCallbackClaimResult =
  | PaymentCallbackReady
  | {
      readonly status: "server-replay-required";
      readonly fresh: PaymentCallbackFreshTuple;
    }
  | {
      readonly status: "invalid";
      readonly reason: PaymentCallbackClaimInvalidReason;
    }
  | { readonly status: "stale" };

export interface PaymentCallbackClaimDependencies {
  readonly checkout: Pick<CheckoutRepository, "readForCallback">;
  readonly callback: Pick<
    CallbackRepository,
    "consumeLegacyConfirmedPaymentHint" | "read" | "write"
  >;
}

export interface ClaimPaymentCallbackInput {
  readonly scope: AuthenticatedSessionScope;
  readonly reservationUid: string;
  readonly fresh?: PaymentCallbackFreshTuple;
  readonly isCurrent: () => boolean;
}

export type ServerPaymentCallbackReplayResult =
  | PaymentCallbackReady
  | {
      readonly status: "server-replay-retryable";
      readonly fresh: PaymentCallbackFreshTuple;
      readonly reason: "ownership-unavailable";
    }
  | {
      readonly status: "invalid";
      readonly reason: "ownership-mismatch";
    }
  | { readonly status: "stale" };

export interface ServerPaymentCallbackReplayDependencies {
  readonly ownershipApi: CheckoutOwnershipApiPort;
}

export interface ResolveServerPaymentCallbackReplayInput {
  readonly fresh: PaymentCallbackFreshTuple;
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
}

const serverReplayOperationId = "server_replay" as BookingPaymentOperationId;

const safelyCheck = (check: () => boolean): boolean => {
  try {
    return check();
  } catch {
    return false;
  }
};

const isBoundedText = (value: string, maximumLength: number): boolean =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximumLength &&
  value.trim() === value;

const isCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    year >= 1 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const isValidFreshTuple = (fresh: PaymentCallbackFreshTuple): boolean =>
  isOpaqueIdentifier(fresh.reservationUid) &&
  isOpaqueIdentifier(fresh.orderId) &&
  fresh.orderId === fresh.reservationUid &&
  isBoundedText(fresh.paymentKey, 512) &&
  Number.isSafeInteger(fresh.amount) &&
  fresh.amount > 0;

const checkoutMatchesReservation = (
  checkout: CheckoutData,
  reservationUid: string,
): boolean =>
  checkout.reservationUid === reservationUid &&
  checkout.adultOccupancy + checkout.childOccupancy > 0;

const callbackMatches = (
  callback: CallbackData,
  checkout: CheckoutData,
  fresh?: PaymentCallbackFreshTuple,
): boolean =>
  callback.operationId === checkout.operationId &&
  callback.reservationUid === checkout.reservationUid &&
  callback.orderId === checkout.reservationUid &&
  callback.amount === checkout.amount &&
  (fresh === undefined ||
    (callback.reservationUid === fresh.reservationUid &&
      callback.orderId === fresh.orderId &&
      callback.paymentKey === fresh.paymentKey &&
      callback.amount === fresh.amount));

const ownershipMatches = (
  ownership: CheckoutOwnership,
  fresh: PaymentCallbackFreshTuple,
): boolean => {
  const payment = ownership.payment;

  return (
    ownership.reservationUid === fresh.reservationUid &&
    Number.isSafeInteger(ownership.accommodationId) &&
    ownership.accommodationId > 0 &&
    isCalendarDate(ownership.checkIn) &&
    isCalendarDate(ownership.checkOut) &&
    ownership.checkIn < ownership.checkOut &&
    Number.isSafeInteger(ownership.guestCount) &&
    ownership.guestCount > 0 &&
    payment !== null &&
    payment.orderId === fresh.orderId &&
    payment.paymentKey === fresh.paymentKey &&
    payment.totalAmount === fresh.amount
  );
};

export const toPaymentCallbackDocument = (
  checkout: CheckoutData,
): PaymentCallbackDocument =>
  Object.freeze({
    operationId: checkout.operationId,
    reservationUid: checkout.reservationUid,
    amount: checkout.amount,
    accommodationId: checkout.accommodationId,
    checkIn: checkout.checkIn,
    checkOut: checkout.checkOut,
    guestCount: checkout.adultOccupancy + checkout.childOccupancy,
  });

const toServerReplayReady = (
  ownership: CheckoutOwnership,
  fresh: PaymentCallbackFreshTuple,
): PaymentCallbackReady => ({
  status: "ready",
  callback: Object.freeze({
    operationId: serverReplayOperationId,
    reservationUid: fresh.reservationUid,
    orderId: fresh.orderId,
    paymentKey: fresh.paymentKey,
    amount: fresh.amount,
    phase: "reconciling",
  }),
  document: Object.freeze({
    operationId: serverReplayOperationId,
    reservationUid: ownership.reservationUid,
    amount: fresh.amount,
    accommodationId: ownership.accommodationId,
    checkIn: ownership.checkIn,
    checkOut: ownership.checkOut,
    guestCount: ownership.guestCount,
  }),
  persistCallback: false,
  shouldConfirm: false,
});

export const claimPaymentCallback = (
  dependencies: PaymentCallbackClaimDependencies,
  input: ClaimPaymentCallbackInput,
): PaymentCallbackClaimResult => {
  const { fresh, reservationUid, scope } = input;

  if (!safelyCheck(input.isCurrent)) return { status: "stale" };
  if (
    !isOpaqueIdentifier(reservationUid) ||
    (fresh !== undefined &&
      (!isValidFreshTuple(fresh) || fresh.reservationUid !== reservationUid))
  ) {
    return { status: "invalid", reason: "invalid-fresh-tuple" };
  }

  const checkoutResult = dependencies.checkout.readForCallback({
    scope,
    reservationUid,
  });
  if (!safelyCheck(input.isCurrent)) return { status: "stale" };
  if (checkoutResult.status !== "found") {
    if (
      checkoutResult.status === "rejected" &&
      checkoutResult.reason === "stale-session"
    ) {
      return { status: "stale" };
    }
    if (checkoutResult.status === "missing" && fresh !== undefined) {
      return { status: "server-replay-required", fresh };
    }

    return { status: "invalid", reason: "checkout-unavailable" };
  }

  const checkout = checkoutResult.data;
  if (!checkoutMatchesReservation(checkout, reservationUid)) {
    return { status: "invalid", reason: "checkout-unavailable" };
  }

  const callbackResult = dependencies.callback.read({
    scope,
    operationId: checkout.operationId,
  });
  if (!safelyCheck(input.isCurrent)) return { status: "stale" };
  if (callbackResult.status === "found") {
    if (!callbackMatches(callbackResult.data, checkout, fresh)) {
      return { status: "invalid", reason: "callback-mismatch" };
    }

    return {
      status: "ready",
      callback: callbackResult.data,
      document: toPaymentCallbackDocument(checkout),
      persistCallback: true,
      // `received` is the durable proof that ownership preflight has not yet
      // opened the confirm-POST boundary. Later phases reconcile only.
      shouldConfirm: callbackResult.data.phase === "received",
    };
  }
  if (
    callbackResult.status === "rejected" &&
    callbackResult.reason === "stale-session"
  ) {
    return { status: "stale" };
  }
  if (callbackResult.status !== "missing") {
    return { status: "invalid", reason: "callback-unavailable" };
  }
  if (fresh === undefined) {
    return { status: "invalid", reason: "missing-callback" };
  }
  if (checkout.amount !== fresh.amount) {
    return { status: "invalid", reason: "callback-mismatch" };
  }

  const marker = dependencies.callback.consumeLegacyConfirmedPaymentHint({
    orderId: fresh.orderId,
    paymentKey: fresh.paymentKey,
    amount: fresh.amount,
  });
  if (!safelyCheck(input.isCurrent)) return { status: "stale" };
  if (marker.status !== "hint") {
    return { status: "invalid", reason: "marker-unavailable" };
  }

  const callback: CallbackData = Object.freeze({
    operationId: checkout.operationId,
    reservationUid: fresh.reservationUid,
    orderId: fresh.orderId,
    paymentKey: fresh.paymentKey,
    amount: fresh.amount,
    phase: marker.shouldReconcile ? "reconciling" : "received",
  });
  const write = dependencies.callback.write({
    scope,
    data: callback,
    isCurrent: input.isCurrent,
  });
  if (write.status === "stale" || !safelyCheck(input.isCurrent)) {
    return { status: "stale" };
  }
  if (write.status !== "written") {
    return { status: "invalid", reason: "callback-write-failed" };
  }

  return {
    status: "ready",
    callback,
    document: toPaymentCallbackDocument(checkout),
    persistCallback: true,
    shouldConfirm: !marker.shouldReconcile,
  };
};

export const resolveServerPaymentCallbackReplay = async (
  dependencies: ServerPaymentCallbackReplayDependencies,
  input: ResolveServerPaymentCallbackReplayInput,
): Promise<ServerPaymentCallbackReplayResult> => {
  if (input.signal.aborted || !safelyCheck(input.isCurrent)) {
    return { status: "stale" };
  }
  if (!isValidFreshTuple(input.fresh)) {
    return { status: "invalid", reason: "ownership-mismatch" };
  }

  let ownership: CheckoutOwnership;
  try {
    ownership = await dependencies.ownershipApi.getCheckoutOwnership(
      input.fresh.reservationUid,
      { signal: input.signal },
    );
  } catch {
    return input.signal.aborted || !safelyCheck(input.isCurrent)
      ? { status: "stale" }
      : {
          status: "server-replay-retryable",
          fresh: input.fresh,
          reason: "ownership-unavailable",
        };
  }

  if (input.signal.aborted || !safelyCheck(input.isCurrent)) {
    return { status: "stale" };
  }
  if (!ownershipMatches(ownership, input.fresh)) {
    return { status: "invalid", reason: "ownership-mismatch" };
  }

  return toServerReplayReady(ownership, input.fresh);
};
