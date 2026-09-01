import type {
  PaymentOperationDetail,
  PaymentOperationApiPort,
} from "../../../../features/reservations/payment/public";
import { isAppError } from "../../../../platform/http/errors";
import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";
import type { BookingPaymentOperationObservation } from "../../journal/recoveryRecordsTypes";
import type { BookingPaymentJournalData } from "../../journal/types";
import {
  isBookingPaymentUuid,
  isSupportedBookingPaymentCardAmount,
} from "../../journal/validation";
import type {
  BookingPaymentCallbackClaimResult,
  BookingPaymentConfirmationResumeReferenceState,
  BookingPaymentConfirmationResumeResult,
  BookingPaymentOperationRecoveryResult,
  BookingPaymentOperationReference,
  BookingPaymentRecoveryWorkflow,
  BookingPaymentRecoveryWorkflowDependencies,
  BookingPaymentSafeOperationObservation,
  BookingPaymentSuccessCallback,
  BookingPaymentTerminalAcknowledgementResult,
} from "./types";

const MINIMUM_RETRY_SECONDS = 2;
const MAXIMUM_RETRY_SECONDS = 30;

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isExactSuccessCallback = (
  value: unknown,
): value is BookingPaymentSuccessCallback =>
  isRecord(value) &&
  hasExactKeys(value, [
    "reservationUid",
    "orderId",
    "paymentKey",
    "amount",
    "firstCapturedAt",
  ]) &&
  isBookingPaymentUuid(value.reservationUid) &&
  value.orderId === value.reservationUid &&
  typeof value.paymentKey === "string" &&
  value.paymentKey.length >= 1 &&
  value.paymentKey.length <= 200 &&
  value.paymentKey.trim().length > 0 &&
  isSupportedBookingPaymentCardAmount(value.amount) &&
  Number.isSafeInteger(value.firstCapturedAt) &&
  (value.firstCapturedAt as number) >= 0;

const isExactOperationReference = (
  value: unknown,
): value is BookingPaymentOperationReference =>
  isRecord(value) &&
  hasExactKeys(value, ["flowId", "operationId", "reservationUid"]) &&
  isBookingPaymentUuid(value.flowId) &&
  isBookingPaymentUuid(value.operationId) &&
  isBookingPaymentUuid(value.reservationUid);

const isExactConfirmationResumeReference = (
  value: unknown,
): value is BookingPaymentConfirmationResumeReferenceState =>
  isRecord(value) &&
  hasExactKeys(value, ["purpose", "version", "flowId", "locator"]) &&
  value.purpose === "booking-payment-flow-reference" &&
  value.version === 2 &&
  isBookingPaymentUuid(value.flowId) &&
  isRecord(value.locator) &&
  hasExactKeys(value.locator, ["kind", "reservationUid"]) &&
  value.locator.kind === "reservation" &&
  isBookingPaymentUuid(value.locator.reservationUid);

const safeCheck = (check: () => boolean): boolean => {
  try {
    return check();
  } catch {
    return false;
  }
};

const toRuntimeLease = (scope: AuthenticatedSessionScope) => ({
  runtimeLeaseId: scope.runtimeLeaseId,
  sessionEpoch: scope.epoch,
});

const fallback = (reservationUid: string) => ({
  kind: "reservation-detail" as const,
  reservationUid,
});

const referenceMatches = (
  left: BookingPaymentOperationReference,
  right: BookingPaymentOperationReference,
): boolean =>
  left.flowId === right.flowId &&
  left.operationId === right.operationId &&
  left.reservationUid === right.reservationUid;

const hasInvariantCause = (error: unknown): boolean => {
  let candidate = error;
  const visited = new Set<unknown>();
  for (let depth = 0; depth < 4; depth += 1) {
    if (candidate instanceof TypeError) return true;
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      visited.has(candidate)
    ) {
      return false;
    }
    visited.add(candidate);
    candidate = "cause" in candidate ? candidate.cause : undefined;
  }
  return false;
};

const classifyConfirmFailure = (
  error: unknown,
): "retryable" | "conflict" | "identity" | "invariant" => {
  if (!isAppError(error)) return "invariant";
  if (error.code === "P006") return "conflict";
  if (
    error.status === 403 ||
    error.code === "P004" ||
    error.code === "R008" ||
    error.kind === "authentication"
  ) {
    return "identity";
  }
  switch (error.kind) {
    case "network":
    case "timeout":
    case "unknown":
      return "retryable";
    case "server":
    case "http":
      return error.retryable ? "retryable" : "invariant";
    default:
      return "invariant";
  }
};

const isRetryablePollFailure = (error: unknown): boolean => {
  if (!isAppError(error)) return !hasInvariantCause(error);
  switch (error.kind) {
    case "network":
    case "timeout":
    case "server":
    case "cancelled":
      return true;
    case "http":
      return error.retryable;
    case "unknown":
      return true;
    default:
      return false;
  }
};

const clampRetrySeconds = (value: number): number =>
  Math.min(MAXIMUM_RETRY_SECONDS, Math.max(MINIMUM_RETRY_SECONDS, value));

const mapOperationObservation = (
  detail: PaymentOperationDetail,
  expectedOperationId: string,
  expectedOrderId: string,
): BookingPaymentOperationObservation | null => {
  if (
    !isRecord(detail) ||
    detail.operationId !== expectedOperationId ||
    detail.orderId !== expectedOrderId ||
    typeof detail.updatedAt !== "string" ||
    typeof detail.serverTime !== "string"
  ) {
    return null;
  }

  switch (detail.status) {
    case "PENDING":
    case "PROCESSING":
      if (
        detail.nextAction !== "POLL" ||
        typeof detail.retryAfterSeconds !== "number" ||
        !Number.isSafeInteger(detail.retryAfterSeconds) ||
        detail.userFailureCode !== null
      ) {
        return null;
      }
      return {
        status: detail.status,
        updatedAt: detail.updatedAt,
        nextAction: "POLL",
        retryAfterSeconds: clampRetrySeconds(detail.retryAfterSeconds),
        userFailureCode: null,
        serverTime: detail.serverTime,
      };
    case "REQUIRES_REVIEW":
      if (
        detail.nextAction !== "CONTACT_SUPPORT" ||
        typeof detail.retryAfterSeconds !== "number" ||
        !Number.isSafeInteger(detail.retryAfterSeconds) ||
        detail.userFailureCode !== "PAYMENT_REVIEW_REQUIRED"
      ) {
        return null;
      }
      return {
        status: "REQUIRES_REVIEW",
        updatedAt: detail.updatedAt,
        nextAction: "CONTACT_SUPPORT",
        retryAfterSeconds: clampRetrySeconds(detail.retryAfterSeconds),
        userFailureCode: "PAYMENT_REVIEW_REQUIRED",
        serverTime: detail.serverTime,
      };
    case "SUCCEEDED":
      if (
        detail.nextAction !== "NONE" ||
        detail.retryAfterSeconds !== null ||
        detail.userFailureCode !== null
      ) {
        return null;
      }
      return {
        status: "SUCCEEDED",
        updatedAt: detail.updatedAt,
        nextAction: "NONE",
        retryAfterSeconds: null,
        userFailureCode: null,
        serverTime: detail.serverTime,
      };
    case "FAILED":
      if (
        (detail.nextAction !== "NONE" &&
          detail.nextAction !== "START_NEW_CHECKOUT") ||
        detail.retryAfterSeconds !== null ||
        detail.userFailureCode !== "PAYMENT_DECLINED"
      ) {
        return null;
      }
      return {
        status: "FAILED",
        updatedAt: detail.updatedAt,
        nextAction: detail.nextAction,
        retryAfterSeconds: null,
        userFailureCode: "PAYMENT_DECLINED",
        serverTime: detail.serverTime,
      };
    default:
      return null;
  }
};

const toOperationResult = (
  reference: BookingPaymentOperationReference,
  observation: BookingPaymentOperationObservation,
): BookingPaymentOperationRecoveryResult => {
  const safeObservation = observation as BookingPaymentSafeOperationObservation;
  if (safeObservation.status === "SUCCEEDED") {
    return { status: "succeeded", reference, observation: safeObservation };
  }
  if (safeObservation.status === "FAILED") {
    return { status: "failed", reference, observation: safeObservation };
  }
  return { status: "unresolved", reference, observation: safeObservation };
};

const retryDelayFromObservation = (
  observation: BookingPaymentOperationObservation | null,
): number =>
  observation !== null &&
  (observation.status === "PENDING" ||
    observation.status === "PROCESSING" ||
    observation.status === "REQUIRES_REVIEW")
    ? (observation.retryAfterSeconds ?? MINIMUM_RETRY_SECONDS)
    : MINIMUM_RETRY_SECONDS;

type Repository = BookingPaymentRecoveryWorkflowDependencies["repository"];
type CallbackAuthority = Extract<
  ReturnType<Repository["recoveryRecords"]["claimCallbackCredential"]>,
  { readonly status: "claimed" | "unchanged" | "found" }
>["authority"];

const hasCallbackAuthority = (
  result: unknown,
): result is { readonly authority: CallbackAuthority } =>
  isRecord(result) &&
  "authority" in result &&
  isRecord(result.authority) &&
  (result.status === "claimed" ||
    result.status === "unchanged" ||
    result.status === "found");

const callbackAuthorityInput = (
  authority: CallbackAuthority,
  isCurrent: () => boolean,
) => ({
  owner: authority.owner,
  lease: authority.lease,
  flowId: authority.flowId,
  reservationUid: authority.reservationUid,
  orderId: authority.orderId,
  paymentAttemptId: authority.paymentAttemptId,
  amount: authority.amount,
  currency: authority.currency,
  isCurrent,
});

type BookingPaymentConfirmationCommandResult = Exclude<
  BookingPaymentConfirmationResumeResult,
  { readonly status: "invalid-reference" }
>;

const mapCallbackRepositoryFailure = (
  result: { readonly status: string; readonly reason?: string },
  reservationUid: string,
): BookingPaymentConfirmationCommandResult => {
  if (result.status === "stale") return { status: "stale" };
  if (result.status === "storage-error") {
    return {
      status: "retryable",
      stage: "storage",
      fallback: fallback(reservationUid),
    };
  }
  if (result.reason === "receipt-present") {
    return {
      status: "receipt-authoritative",
      fallback: fallback(reservationUid),
    };
  }
  if (
    result.status === "missing" ||
    result.reason === "expired" ||
    result.reason === "missing-journal" ||
    result.reason === "missing-credential" ||
    result.reason === "malformed" ||
    result.reason === "opaque-v2-state"
  ) {
    return {
      status: "recovery-unavailable",
      fallback: fallback(reservationUid),
    };
  }
  return {
    status: "terminal-failure",
    reason:
      result.reason === "foreign-owner" || result.reason === "stale-lease"
        ? "identity"
        : "invariant",
    fallback: fallback(reservationUid),
  };
};

const mapCallbackClaimRepositoryFailure = (
  result: { readonly status: string; readonly reason?: string },
  reservationUid: string,
): Exclude<
  BookingPaymentCallbackClaimResult,
  { readonly status: "confirmation-ready" | "invalid-callback" }
> => {
  const mapped = mapCallbackRepositoryFailure(result, reservationUid);
  if (mapped.status === "retryable") {
    return {
      status: "retryable",
      stage: "storage",
      fallback: mapped.fallback,
    };
  }
  if (mapped.status === "operation-accepted" || mapped.status === "busy") {
    return {
      status: "terminal-failure",
      reason: "invariant",
      fallback: fallback(reservationUid),
    };
  }
  return mapped;
};

const mapReceiptRepositoryFailure = (
  result: { readonly status: string; readonly reason?: string },
  reference: BookingPaymentOperationReference,
): BookingPaymentOperationRecoveryResult => {
  if (result.status === "stale") return { status: "stale" };
  if (result.status === "verified-expired") {
    return {
      status: "verified-expired",
      reference,
      fallback: fallback(reference.reservationUid),
    };
  }
  if (result.status === "storage-error") {
    return {
      status: "retryable",
      reference,
      retryAfterSeconds: MINIMUM_RETRY_SECONDS,
    };
  }
  return {
    status: "recovery-unavailable",
    fallback: fallback(reference.reservationUid),
  };
};

const resumeReferenceMatches = (
  left: BookingPaymentConfirmationResumeReferenceState,
  right: BookingPaymentConfirmationResumeReferenceState,
): boolean =>
  left.flowId === right.flowId &&
  left.locator.reservationUid === right.locator.reservationUid;

export const createBookingPaymentRecoveryWorkflow = ({
  api,
  repository,
  routeLease,
  session,
}: BookingPaymentRecoveryWorkflowDependencies): BookingPaymentRecoveryWorkflow => {
  let disposed = false;
  let activeConfirm: {
    readonly reference: BookingPaymentConfirmationResumeReferenceState;
    readonly controller: AbortController;
    readonly promise: Promise<BookingPaymentConfirmationCommandResult>;
  } | null = null;
  let activePoll: {
    readonly reference: BookingPaymentOperationReference;
    readonly controller: AbortController;
    readonly promise: Promise<BookingPaymentOperationRecoveryResult>;
  } | null = null;

  const isScopeCurrent = (scope: AuthenticatedSessionScope): boolean =>
    !disposed &&
    safeCheck(() => routeLease.isCurrent()) &&
    safeCheck(() => session.isCurrentSession(scope));

  const advanceCallbackPhase = (
    authority: CallbackAuthority,
    expectedPhase: "attempt-ready" | "callback-received",
    nextPhase: "callback-received" | "confirm-submitting",
    isCurrent: () => boolean,
  ) => {
    const authorityInput = callbackAuthorityInput(authority, isCurrent);
    const read = repository.read({
      owner: authority.owner,
      lease: authority.lease,
      flowId: authority.flowId,
      locator: {
        kind: "reservation",
        reservationUid: authority.reservationUid,
      },
      isCurrent,
    });
    if (read.status !== "found") return read;
    if (read.record.data.phase === nextPhase) {
      return repository.recoveryRecords.readCallbackCredentialAuthority(
        authorityInput,
      );
    }
    if (
      expectedPhase === "attempt-ready" &&
      read.record.data.phase === "confirm-submitting"
    ) {
      return repository.recoveryRecords.readCallbackCredentialAuthority(
        authorityInput,
      );
    }
    if (read.record.data.phase !== expectedPhase) {
      return { status: "rejected" as const, reason: "phase-mismatch" as const };
    }
    const nextData = {
      ...read.record.data,
      phase: nextPhase,
    } as BookingPaymentJournalData;
    const replaced = repository.replaceExpectedPhase({
      owner: authority.owner,
      lease: authority.lease,
      flowId: authority.flowId,
      locator: {
        kind: "reservation",
        reservationUid: authority.reservationUid,
      },
      expectedPhase,
      nextData,
      isCurrent,
    });
    if (
      replaced.status !== "written" &&
      replaced.status !== "unchanged" &&
      replaced.status !== "stale"
    ) {
      return replaced;
    }
    if (replaced.status === "stale") return replaced;
    return repository.recoveryRecords.readCallbackCredentialAuthority(
      authorityInput,
    );
  };

  const submitConfirmation = async (
    initialAuthority: CallbackAuthority,
    reservationUid: string,
    scope: AuthenticatedSessionScope,
    controller: AbortController,
  ): Promise<BookingPaymentConfirmationCommandResult> => {
    const isCurrent = () => isScopeCurrent(scope);
    const lease = toRuntimeLease(scope);
    let authority = initialAuthority;

    // This joined credential read is also the immediate receipt-slot barrier.
    const preflight =
      repository.recoveryRecords.readCallbackCredentialAuthority(
        callbackAuthorityInput(authority, isCurrent),
      );
    if (!hasCallbackAuthority(preflight)) {
      return mapCallbackRepositoryFailure(preflight, reservationUid);
    }
    authority = preflight.authority;
    if (!isCurrent()) return { status: "stale" };

    let accepted: Awaited<
      ReturnType<PaymentOperationApiPort["confirmPaymentOperation"]>
    >;
    try {
      accepted = await api.confirmPaymentOperation(
        {
          paymentKey: authority.paymentKey,
          orderId: authority.orderId,
          amount: authority.amount,
          paymentAttemptId: authority.paymentAttemptId,
        },
        { signal: controller.signal },
      );
    } catch (error) {
      if (!isCurrent()) return { status: "stale" };
      const failure = classifyConfirmFailure(error);
      if (failure === "retryable") {
        return {
          status: "retryable",
          stage: "confirm",
          fallback: fallback(reservationUid),
        };
      }
      if (failure === "invariant") {
        return {
          status: "recovery-unavailable",
          fallback: fallback(reservationUid),
        };
      }
      return {
        status: "terminal-failure",
        reason: failure,
        fallback: fallback(reservationUid),
      };
    }

    if (!isCurrent()) return { status: "stale" };
    if (!isRecord(accepted) || !isBookingPaymentUuid(accepted.operationId)) {
      return {
        status: "terminal-failure",
        reason: "invariant",
        fallback: fallback(reservationUid),
      };
    }
    const reference: BookingPaymentOperationReference = {
      flowId: authority.flowId,
      operationId: accepted.operationId,
      reservationUid: authority.reservationUid,
    };
    const handoff = repository.recoveryRecords.handoffAcceptedReceipt({
      ...callbackAuthorityInput(authority, isCurrent),
      operationId: accepted.operationId,
    });
    if (handoff.status === "handed-off") {
      return isCurrent()
        ? {
            status: "operation-accepted",
            reference,
            cleanup: handoff.cleanup,
          }
        : { status: "stale" };
    }

    if (handoff.status === "rejected" && handoff.reason === "receipt-present") {
      const existing = repository.recoveryRecords.claimReceiptLease({
        owner: scope.subject,
        lease,
        ...reference,
        isCurrent,
      });
      if (
        existing.status === "claimed" ||
        existing.status === "unchanged" ||
        existing.status === "found"
      ) {
        return isCurrent()
          ? { status: "operation-accepted", reference, cleanup: "pending" }
          : { status: "stale" };
      }
    }

    if (handoff.status === "stale") return { status: "stale" };
    return {
      status: "retryable",
      stage: "receipt-handoff",
      fallback: fallback(reservationUid),
    };
  };

  const prepareConfirmationReference = (
    initialAuthority: CallbackAuthority,
    reservationUid: string,
    isCurrent: () => boolean,
  ): BookingPaymentCallbackClaimResult => {
    let authority = initialAuthority;
    if (authority.phase === "attempt-ready") {
      const advanced = advanceCallbackPhase(
        authority,
        "attempt-ready",
        "callback-received",
        isCurrent,
      );
      if (!hasCallbackAuthority(advanced)) {
        return mapCallbackClaimRepositoryFailure(advanced, reservationUid);
      }
      authority = advanced.authority;
    }

    if (authority.phase === "callback-received") {
      const advanced = advanceCallbackPhase(
        authority,
        "callback-received",
        "confirm-submitting",
        isCurrent,
      );
      if (!hasCallbackAuthority(advanced)) {
        return mapCallbackClaimRepositoryFailure(advanced, reservationUid);
      }
      authority = advanced.authority;
    }

    if (authority.phase !== "confirm-submitting") {
      return {
        status: "terminal-failure",
        reason: "invariant",
        fallback: fallback(reservationUid),
      };
    }
    const preflight =
      repository.recoveryRecords.readCallbackCredentialAuthority(
        callbackAuthorityInput(authority, isCurrent),
      );
    if (!hasCallbackAuthority(preflight)) {
      return mapCallbackClaimRepositoryFailure(preflight, reservationUid);
    }
    return isCurrent()
      ? {
          status: "confirmation-ready",
          reference: {
            purpose: "booking-payment-flow-reference",
            version: 2,
            flowId: preflight.authority.flowId,
            locator: {
              kind: "reservation",
              reservationUid: preflight.authority.reservationUid,
            },
          },
        }
      : { status: "stale" };
  };

  const runCallbackClaim = (
    callback: BookingPaymentSuccessCallback,
    scope: AuthenticatedSessionScope,
  ): BookingPaymentCallbackClaimResult => {
    const isCurrent = () => isScopeCurrent(scope);
    const claimed = repository.recoveryRecords.claimCallbackCredential({
      owner: scope.subject,
      lease: toRuntimeLease(scope),
      reservationUid: callback.reservationUid,
      orderId: callback.orderId,
      paymentKey: callback.paymentKey,
      amount: callback.amount,
      firstCapturedAt: callback.firstCapturedAt,
      isCurrent,
    });
    if (!hasCallbackAuthority(claimed)) {
      return mapCallbackClaimRepositoryFailure(
        claimed,
        callback.reservationUid,
      );
    }
    return prepareConfirmationReference(
      claimed.authority,
      callback.reservationUid,
      isCurrent,
    );
  };

  const runStoredCallbackClaim = (
    reservationUid: string,
    scope: AuthenticatedSessionScope,
  ): BookingPaymentCallbackClaimResult => {
    const isCurrent = () => isScopeCurrent(scope);
    const claimed =
      repository.recoveryRecords.claimStoredCallbackCredentialByReservation({
        owner: scope.subject,
        lease: toRuntimeLease(scope),
        reservationUid,
        isCurrent,
      });
    if (!hasCallbackAuthority(claimed)) {
      return mapCallbackClaimRepositoryFailure(claimed, reservationUid);
    }
    return prepareConfirmationReference(
      claimed.authority,
      reservationUid,
      isCurrent,
    );
  };

  const runResumeConfirmation = async (
    reference: BookingPaymentConfirmationResumeReferenceState,
    scope: AuthenticatedSessionScope,
    controller: AbortController,
  ): Promise<BookingPaymentConfirmationCommandResult> => {
    const isCurrent = () => isScopeCurrent(scope);
    const claimed = repository.recoveryRecords.claimCallbackCredentialForResume(
      {
        owner: scope.subject,
        lease: toRuntimeLease(scope),
        flowId: reference.flowId,
        reservationUid: reference.locator.reservationUid,
        isCurrent,
      },
    );
    if (!hasCallbackAuthority(claimed)) {
      return mapCallbackRepositoryFailure(
        claimed,
        reference.locator.reservationUid,
      );
    }
    if (claimed.authority.phase !== "confirm-submitting") {
      return {
        status: "recovery-unavailable",
        fallback: fallback(reference.locator.reservationUid),
      };
    }
    return submitConfirmation(
      claimed.authority,
      reference.locator.reservationUid,
      scope,
      controller,
    );
  };

  const runPoll = async (
    reference: BookingPaymentOperationReference,
    scope: AuthenticatedSessionScope,
    controller: AbortController,
  ): Promise<BookingPaymentOperationRecoveryResult> => {
    const isCurrent = () => isScopeCurrent(scope);
    const claimed = repository.recoveryRecords.claimReceiptLease({
      owner: scope.subject,
      lease: toRuntimeLease(scope),
      ...reference,
      isCurrent,
    });
    if (
      claimed.status !== "claimed" &&
      claimed.status !== "unchanged" &&
      claimed.status !== "found"
    ) {
      return mapReceiptRepositoryFailure(claimed, reference);
    }
    if (!isCurrent()) return { status: "stale" };
    if (
      claimed.authority.observation?.status === "SUCCEEDED" ||
      claimed.authority.observation?.status === "FAILED"
    ) {
      return toOperationResult(reference, claimed.authority.observation);
    }

    let detail: PaymentOperationDetail;
    try {
      detail = await api.getPaymentOperation(
        claimed.authority.operation.operationId,
        claimed.authority.operation.orderId,
        { signal: controller.signal },
      );
    } catch (error) {
      if (!isCurrent()) return { status: "stale" };
      return isRetryablePollFailure(error)
        ? {
            status: "retryable",
            reference,
            retryAfterSeconds: retryDelayFromObservation(
              claimed.authority.observation,
            ),
          }
        : {
            status: "recovery-unavailable",
            fallback: fallback(reference.reservationUid),
          };
    }
    if (!isCurrent()) return { status: "stale" };

    const observation = mapOperationObservation(
      detail,
      claimed.authority.operation.operationId,
      claimed.authority.operation.orderId,
    );
    if (observation === null) {
      return {
        status: "recovery-unavailable",
        fallback: fallback(reference.reservationUid),
      };
    }
    const persisted = repository.recoveryRecords.replaceReceiptObservation({
      owner: scope.subject,
      lease: toRuntimeLease(scope),
      ...reference,
      observation,
      isCurrent,
    });
    if (
      persisted.status !== "replaced" &&
      persisted.status !== "unchanged" &&
      persisted.status !== "found" &&
      persisted.status !== "claimed"
    ) {
      return mapReceiptRepositoryFailure(persisted, reference);
    }
    if (!isCurrent()) return { status: "stale" };
    if (persisted.authority.observation === null) {
      return {
        status: "recovery-unavailable",
        fallback: fallback(reference.reservationUid),
      };
    }
    return toOperationResult(reference, persisted.authority.observation);
  };

  return {
    claimCallback(rawCallback) {
      if (!isExactSuccessCallback(rawCallback)) {
        return { status: "invalid-callback" };
      }
      const callback = { ...rawCallback };
      if (disposed || !safeCheck(() => routeLease.isCurrent())) {
        return { status: "stale" };
      }
      const scope = session.captureAuthenticatedSession();
      if (scope === null) return { status: "auth-required" };
      if (!isScopeCurrent(scope)) return { status: "stale" };
      return runCallbackClaim(callback, scope);
    },

    recoverClaimedCallback(reservationUid) {
      if (!isBookingPaymentUuid(reservationUid)) {
        return { status: "invalid-callback" };
      }
      if (disposed || !safeCheck(() => routeLease.isCurrent())) {
        return { status: "stale" };
      }
      const scope = session.captureAuthenticatedSession();
      if (scope === null) return { status: "auth-required" };
      if (!isScopeCurrent(scope)) return { status: "stale" };
      return runStoredCallbackClaim(reservationUid, scope);
    },

    resumeConfirmation(rawReference) {
      if (!isExactConfirmationResumeReference(rawReference)) {
        return Promise.resolve({ status: "invalid-reference" });
      }
      const reference: BookingPaymentConfirmationResumeReferenceState = {
        purpose: rawReference.purpose,
        version: rawReference.version,
        flowId: rawReference.flowId,
        locator: { ...rawReference.locator },
      };
      if (activeConfirm) {
        return resumeReferenceMatches(activeConfirm.reference, reference)
          ? activeConfirm.promise
          : Promise.resolve({ status: "busy" });
      }
      if (disposed || !safeCheck(() => routeLease.isCurrent())) {
        return Promise.resolve({ status: "stale" });
      }
      const scope = session.captureAuthenticatedSession();
      if (scope === null) return Promise.resolve({ status: "auth-required" });
      if (!isScopeCurrent(scope)) return Promise.resolve({ status: "stale" });

      const controller = new AbortController();
      const promise = runResumeConfirmation(
        reference,
        scope,
        controller,
      ).finally(() => {
        if (activeConfirm?.promise === promise) activeConfirm = null;
      });
      activeConfirm = {
        reference,
        controller,
        promise,
      };
      return promise as Promise<BookingPaymentConfirmationResumeResult>;
    },

    pollOperation(rawReference) {
      if (!isExactOperationReference(rawReference)) {
        return Promise.resolve({ status: "invalid-reference" });
      }
      const reference = { ...rawReference };
      if (activePoll) {
        return referenceMatches(activePoll.reference, reference)
          ? activePoll.promise
          : Promise.resolve({ status: "busy" });
      }
      if (disposed || !safeCheck(() => routeLease.isCurrent())) {
        return Promise.resolve({ status: "stale" });
      }
      const scope = session.captureAuthenticatedSession();
      if (scope === null) return Promise.resolve({ status: "auth-required" });
      if (!isScopeCurrent(scope)) return Promise.resolve({ status: "stale" });

      const controller = new AbortController();
      const promise = runPoll(reference, scope, controller).finally(() => {
        if (activePoll?.promise === promise) activePoll = null;
      });
      activePoll = { reference, controller, promise };
      return promise;
    },

    acknowledgeTerminal(
      rawReference,
    ): BookingPaymentTerminalAcknowledgementResult {
      if (!isExactOperationReference(rawReference)) {
        return { status: "invalid-reference" };
      }
      const reference = { ...rawReference };
      if (disposed || !safeCheck(() => routeLease.isCurrent())) {
        return { status: "stale" };
      }
      const scope = session.captureAuthenticatedSession();
      if (scope === null) return { status: "auth-required" };
      const isCurrent = () => isScopeCurrent(scope);
      if (!isCurrent()) return { status: "stale" };
      const lease = toRuntimeLease(scope);
      const claimed = repository.recoveryRecords.claimReceiptLease({
        owner: scope.subject,
        lease,
        ...reference,
        isCurrent,
      });
      if (
        claimed.status !== "claimed" &&
        claimed.status !== "unchanged" &&
        claimed.status !== "found"
      ) {
        if (claimed.status === "stale") return { status: "stale" };
        return claimed.status === "storage-error"
          ? {
              status: "retryable",
              fallback: fallback(reference.reservationUid),
            }
          : {
              status: "recovery-unavailable",
              fallback: fallback(reference.reservationUid),
            };
      }
      if (
        claimed.authority.observation?.status !== "SUCCEEDED" &&
        claimed.authority.observation?.status !== "FAILED"
      ) {
        return { status: "not-terminal" };
      }
      const acknowledged =
        repository.recoveryRecords.acknowledgeTerminalReceipt({
          owner: scope.subject,
          lease,
          ...reference,
          isCurrent,
        });
      if (acknowledged.status === "cleared") {
        return isCurrent() ? { status: "acknowledged" } : { status: "stale" };
      }
      if (acknowledged.status === "stale") return { status: "stale" };
      return acknowledged.status === "storage-error" ||
        (acknowledged.status === "rejected" &&
          (acknowledged.reason === "cleanup-not-verified" ||
            acknowledged.reason === "write-not-verified"))
        ? {
            status: "retryable",
            fallback: fallback(reference.reservationUid),
          }
        : {
            status: "recovery-unavailable",
            fallback: fallback(reference.reservationUid),
          };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      activeConfirm?.controller.abort();
      activePoll?.controller.abort();
    },
  };
};
