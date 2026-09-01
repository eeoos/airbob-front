import type {
  ReservationQuote,
  ReservationReady,
} from "../../../../features/reservations/booking/public";
import type {
  PaymentAttempt,
  ReservationHoldRelease,
} from "../../../../features/reservations/payment/public";
import {
  createCryptographicUuid,
  sha256Base64Url,
} from "../../../../platform/crypto/secureIdentifiers";
import { isAppError } from "../../../../platform/http/errors";
import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";
import {
  PaymentGatewayError,
  type PaymentGatewayRequest,
} from "../../checkout/paymentGateway";
import {
  clearTerminalBookingPaymentBrowserState,
  createBookingPaymentJournalRepository,
} from "../../journal";
import type {
  BookingPaymentAttempt,
  BookingPaymentJournalData,
  BookingPaymentJournalEnvelope,
  BookingPaymentReady,
  BookingPaymentRecoveryLocator,
  BookingPaymentRuntimeLease,
} from "../../journal/types";
import {
  isBookingPaymentUuid,
  isSupportedBookingPaymentCardAmount,
} from "../../journal/validation";
import type {
  BookingTransactionAccessFailure,
  BookingTransactionAbandonResult,
  BookingTransactionAcknowledgementResult,
  BookingTransactionAuthorityInput,
  BookingTransactionCheckoutResult,
  BookingTransactionHandle,
  BookingTransactionLoadResult,
  BookingTransactionPayInput,
  BookingTransactionPayResult,
  BookingTransactionPrepareResult,
  BookingTransactionQuoteInput,
  BookingTransactionQuoteResult,
  BookingTransactionReleaseResult,
  BookingTransactionRequestFailure,
  BookingTransactionReservationStatusObservation,
  BookingTransactionSnapshot,
  BookingTransactionStatusDriftAcknowledgementResult,
  BookingTransactionWorkflow,
  BookingTransactionWorkflowDependencies,
} from "./types";
import {
  BookingTransactionValidationError,
  validateBookingTransactionQuoteInput,
} from "./validation";

const EXACT_CHECKOUT_RESOURCE = "/api/v1/reservations" as const;
const GENERIC_APPLIED_COUPON_LABEL = "적용된 쿠폰";
const CHECKOUT_CONFLICT_CODES = new Set(["R016", "R020"]);
const DEFINITIVE_UNHELD_CODES = new Set(["R017", "R018", "R019"]);
const ATTEMPT_UNAVAILABLE_CODES = new Set(["R022", "R023"]);

const safeCheck = (check: () => boolean): boolean => {
  try {
    return check();
  } catch {
    return false;
  }
};

const captureSession = (
  dependencies: BookingTransactionWorkflowDependencies,
): AuthenticatedSessionScope | null => {
  try {
    return dependencies.session.captureAuthenticatedSession();
  } catch {
    return null;
  }
};

const toRuntimeLease = (
  scope: AuthenticatedSessionScope,
): BookingPaymentRuntimeLease => ({
  runtimeLeaseId: scope.runtimeLeaseId,
  sessionEpoch: scope.epoch,
});

const isPositiveSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

const isValidLocator = (locator: BookingPaymentRecoveryLocator): boolean =>
  locator.kind === "accommodation"
    ? isPositiveSafeInteger(locator.accommodationId)
    : isBookingPaymentUuid(locator.reservationUid);

const isValidHandle = (handle: BookingTransactionHandle): boolean =>
  isBookingPaymentUuid(handle.flowId) && isValidLocator(handle.locator);

const handleKey = (handle: BookingTransactionHandle): string =>
  handle.locator.kind === "accommodation"
    ? `${handle.flowId}:accommodation:${handle.locator.accommodationId}`
    : `${handle.flowId}:reservation:${handle.locator.reservationUid}`;

const quoteKey = (input: BookingTransactionQuoteInput): string =>
  JSON.stringify({
    intent: input.intent,
    accommodation: input.accommodation,
    availability: input.availability,
    coupon: input.appliedCoupon,
  });

const freezeHandle = (
  flowId: string,
  locator: BookingPaymentRecoveryLocator,
): BookingTransactionHandle =>
  Object.freeze({
    flowId,
    locator: Object.freeze({ ...locator }) as BookingPaymentRecoveryLocator,
  });

const handleForData = (
  data: BookingPaymentJournalData,
): BookingTransactionHandle =>
  freezeHandle(
    data.flowId,
    "ready" in data
      ? { kind: "reservation", reservationUid: data.ready.reservationUid }
      : {
          kind: "accommodation",
          accommodationId: data.serverIntent.accommodationId,
        },
  );

const latestServerTime = (data: BookingPaymentJournalData): string => {
  if ("release" in data) return data.release.serverTime;
  if ("attempt" in data) return data.attempt.serverTime;
  if ("ready" in data) return data.ready.serverTime;
  return data.quote.serverTime;
};

const toSnapshot = (
  data: BookingPaymentJournalData,
): BookingTransactionSnapshot => {
  const ready = "ready" in data ? data.ready : null;
  const phase = data.phase;

  return Object.freeze({
    phase,
    flowId: data.flowId,
    accommodationId: data.serverIntent.accommodationId,
    reservationUid: ready?.reservationUid ?? null,
    checkIn: data.quote.checkIn,
    checkOut: data.quote.checkOut,
    adultCount: data.presentationIntent.adultCount,
    childCount: data.presentationIntent.childCount,
    infantCount: data.presentationIntent.infantCount,
    petCount: data.presentationIntent.petCount,
    orderName: data.quote.orderName,
    nightlyPrice: data.quote.nightlyPrice,
    nights: data.quote.nights,
    subtotal: data.quote.subtotal,
    discountAmount: data.quote.discountAmount,
    amount: data.quote.amount,
    currency: data.quote.currency,
    couponDisplayName:
      data.serverIntent.couponId === null ? null : GENERIC_APPLIED_COUPON_LABEL,
    quoteExpiresAt: data.quote.quoteExpiresAt,
    serverTime: latestServerTime(data),
    paymentRequired: data.quote.paymentRequired,
    reservationStatus: ready?.status ?? null,
    paymentAllowed: ready?.paymentAllowed ?? false,
    holdExpiresAt: ready?.holdExpiresAt ?? null,
    canCheckout:
      phase === "quoted" ||
      phase === "checkout-prepared" ||
      phase === "checkout-submitting",
    canPay:
      phase === "reservation-ready" ||
      phase === "attempt-requesting" ||
      phase === "attempt-ready",
    canRetryPayment:
      phase === "attempt-requesting" || phase === "attempt-ready",
    canReleaseHold:
      phase === "reservation-ready" ||
      phase === "attempt-requesting" ||
      phase === "attempt-ready" ||
      phase === "hold-release-requesting",
  });
};

const toRequestFailure = (error: unknown): BookingTransactionRequestFailure => {
  if (!isAppError(error)) {
    return Object.freeze({ code: "UNKNOWN_ERROR", retryable: true });
  }

  return Object.freeze({
    code: error.code,
    retryable:
      error.retryable ||
      error.kind === "cancelled" ||
      error.kind === "network" ||
      error.kind === "server" ||
      error.kind === "timeout" ||
      error.kind === "unknown",
  });
};

const isDefinitiveQuoteFailure = (error: unknown): boolean =>
  isAppError(error) &&
  (error.kind === "authentication" ||
    error.kind === "validation" ||
    error.kind === "conflict" ||
    (error.kind === "http" && !error.retryable));

const toSafeGatewayError = (error: unknown): PaymentGatewayError =>
  error instanceof PaymentGatewayError
    ? error
    : new PaymentGatewayError({
        kind: "recoverable",
        message: "결제 진행 중 오류가 발생했습니다.",
      });

const isBoundedText = (value: string, maxLength: number): boolean =>
  value.length > 0 && value.length <= maxLength && value.trim() === value;

const isNonBlankBoundedText = (value: string, maxLength: number): boolean =>
  value.length <= maxLength && value.trim().length > 0;

const isSafeRedirectUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    const loopback =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    return (
      (url.protocol === "https:" || (url.protocol === "http:" && loopback)) &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
};

const isValidPayInput = (input: BookingTransactionPayInput): boolean =>
  isBoundedText(input.customer.email, 100) &&
  isBoundedText(input.customer.name, 100) &&
  isSafeRedirectUrl(input.successUrl) &&
  isSafeRedirectUrl(input.failUrl);

const callbackUrlsMatchReservation = (
  input: BookingTransactionPayInput,
  reservationUid: string,
): boolean => {
  const successUrl = new URL(input.successUrl);
  const failUrl = new URL(input.failUrl);
  const targetsReservation = (url: URL) =>
    url.pathname.split("/").includes(reservationUid);

  return (
    successUrl.origin === failUrl.origin &&
    targetsReservation(successUrl) &&
    targetsReservation(failUrl)
  );
};

const toReservationQuote = (
  data: BookingPaymentJournalData,
): ReservationQuote => ({
  quoteUid: data.quote.quoteUid,
  accommodationId: data.quote.accommodationId,
  orderName: data.quote.orderName,
  checkIn: data.quote.checkIn,
  checkOut: data.quote.checkOut,
  guestCount: data.quote.guestCount,
  nightlyPrice: data.quote.nightlyPrice,
  nights: data.quote.nights,
  subtotal: data.quote.subtotal,
  discountAmount: data.quote.discountAmount,
  amount: data.quote.amount,
  currency: data.quote.currency,
  paymentRequired: data.quote.paymentRequired,
  inventoryHeld: false,
  quoteExpiresAt: data.quote.quoteExpiresAt,
  serverTime: data.quote.serverTime,
});

const toReady = (ready: ReservationReady): BookingPaymentReady => ({
  ...ready,
});

const toAttempt = (attempt: PaymentAttempt): BookingPaymentAttempt => ({
  ...attempt,
});

const exactCheckoutBody = (quoteUid: string): string =>
  JSON.stringify({ quote_uid: quoteUid, request_message: null });

type JournalRepository = ReturnType<
  typeof createBookingPaymentJournalRepository
>;

interface ResolvedAuthority {
  readonly status: "found";
  readonly scope: AuthenticatedSessionScope;
  readonly record: BookingPaymentJournalEnvelope;
  readonly isCurrent: () => boolean;
}

type AuthorityResolution = ResolvedAuthority | BookingTransactionAccessFailure;

const mapJournalAccessFailure = (
  status: string,
  reason?: string,
): BookingTransactionAccessFailure => {
  if (status === "stale") return { status: "stale" };
  if (status === "missing" || reason === "missing-journal") {
    return { status: "missing" };
  }
  if (status === "storage-error") {
    return { status: "blocked", reason: "storage-unavailable" };
  }
  if (reason === "foreign-owner" || reason === "active-journal") {
    return { status: "blocked", reason: "recovery-required" };
  }
  return { status: "blocked", reason: "invalid-authority" };
};

const mapJournalWriteFailure = (
  status: string,
  reason?: string,
): BookingTransactionAccessFailure => {
  if (status === "stale") return { status: "stale" };
  if (status === "storage-error") {
    return { status: "blocked", reason: "storage-unavailable" };
  }
  if (reason === "foreign-owner" || reason === "active-journal") {
    return { status: "blocked", reason: "recovery-required" };
  }
  return { status: "blocked", reason: "persistence-unavailable" };
};

export const createBookingTransactionWorkflow = (
  dependencies: BookingTransactionWorkflowDependencies,
): BookingTransactionWorkflow => {
  const journal: JournalRepository =
    dependencies.journal ?? createBookingPaymentJournalRepository();
  const clearRetiredState =
    dependencies.clearRetiredState ?? clearTerminalBookingPaymentBrowserState;
  const createUuid = dependencies.createUuid ?? createCryptographicUuid;
  const fingerprint = dependencies.fingerprint ?? sha256Base64Url;

  let disposed = false;
  const controllers = new Set<AbortController>();
  let activeQuote: {
    readonly key: string;
    readonly promise: Promise<BookingTransactionQuoteResult>;
  } | null = null;
  let activeCheckout: {
    readonly key: string;
    readonly promise: Promise<BookingTransactionCheckoutResult>;
  } | null = null;
  let activePrepare: {
    readonly key: string;
    readonly promise: Promise<BookingTransactionPrepareResult>;
  } | null = null;
  let commandLane:
    | {
        readonly kind: "pay";
        readonly key: string;
        readonly promise: Promise<BookingTransactionPayResult>;
      }
    | {
        readonly kind: "release";
        readonly key: string;
        readonly promise: Promise<BookingTransactionReleaseResult>;
      }
    | null = null;

  const currentFailure = (): Extract<
    BookingTransactionAccessFailure,
    { readonly status: "stale" | "locked" }
  > =>
    disposed ? { status: "locked", terminal: "disposed" } : { status: "stale" };

  const createController = (): AbortController => {
    const controller = new AbortController();
    controllers.add(controller);
    return controller;
  };

  const releaseController = (controller: AbortController): void => {
    controllers.delete(controller);
  };

  const resolveAuthority = (
    input: BookingTransactionAuthorityInput,
    allowMigratedReservationLocator = false,
  ): AuthorityResolution => {
    if (disposed) return { status: "locked", terminal: "disposed" };
    if (
      !isValidHandle(input.handle) ||
      !safeCheck(() => input.routeLease.isCurrent())
    ) {
      return { status: "blocked", reason: "invalid-authority" };
    }

    const scope = captureSession(dependencies);
    if (scope === null) return { status: "auth-required" };
    const isCurrent = () =>
      !disposed &&
      safeCheck(() => input.routeLease.isCurrent()) &&
      safeCheck(() => dependencies.session.isCurrentSession(scope));
    if (!isCurrent()) return currentFailure();

    const authority = {
      owner: scope.subject,
      lease: toRuntimeLease(scope),
      flowId: input.handle.flowId,
      locator: input.handle.locator,
      isCurrent,
    };
    let claimed = journal.claimRecoveryLease(authority);
    let effectiveLocator = input.handle.locator;
    if (
      claimed.status === "rejected" &&
      claimed.reason === "locator-mismatch" &&
      allowMigratedReservationLocator &&
      input.handle.locator.kind === "accommodation"
    ) {
      claimed = journal.claimMigratedReservationRecoveryLease(authority);
      if (claimed.status === "written") {
        effectiveLocator = handleForData(claimed.record.data).locator;
      }
    }
    if (claimed.status !== "written" && claimed.status !== "unchanged") {
      return mapJournalAccessFailure(
        claimed.status,
        "reason" in claimed ? claimed.reason : undefined,
      );
    }
    if (!isCurrent()) return currentFailure();

    const read = journal.read({ ...authority, locator: effectiveLocator });
    if (read.status !== "found") {
      return mapJournalAccessFailure(
        read.status,
        "reason" in read ? read.reason : undefined,
      );
    }
    if (!isCurrent()) return currentFailure();
    return { status: "found", scope, record: read.record, isCurrent };
  };

  const replacePhase = (
    authority: ResolvedAuthority,
    locator: BookingPaymentRecoveryLocator,
    expectedPhase: BookingPaymentJournalData["phase"],
    nextData: BookingPaymentJournalData,
  ) =>
    journal.replaceExpectedPhase({
      owner: authority.scope.subject,
      lease: toRuntimeLease(authority.scope),
      flowId: authority.record.data.flowId,
      locator,
      expectedPhase,
      nextData,
      isCurrent: authority.isCurrent,
    });

  const quote = (
    input: BookingTransactionQuoteInput,
  ): Promise<BookingTransactionQuoteResult> => {
    if (disposed) {
      return Promise.resolve({ status: "locked", terminal: "disposed" });
    }

    let intent;
    try {
      intent = validateBookingTransactionQuoteInput(input);
    } catch (error) {
      if (!safeCheck(() => input.routeLease.isCurrent())) {
        return Promise.resolve({ status: "stale" });
      }
      if (error instanceof BookingTransactionValidationError) {
        return Promise.resolve({ status: "invalid", error });
      }
      return Promise.resolve({
        status: "blocked",
        reason: "persistence-unavailable",
      });
    }

    const key = quoteKey(input);
    if (activeQuote) {
      return activeQuote.key === key
        ? activeQuote.promise
        : Promise.resolve({ status: "busy" });
    }
    if (!safeCheck(() => input.routeLease.isCurrent())) {
      return Promise.resolve({ status: "stale" });
    }
    const scope = captureSession(dependencies);
    if (scope === null) {
      return Promise.resolve({ status: "auth-required", intent });
    }
    const isCurrent = () =>
      !disposed &&
      safeCheck(() => input.routeLease.isCurrent()) &&
      safeCheck(() => dependencies.session.isCurrentSession(scope));
    if (!isCurrent()) return Promise.resolve(currentFailure());

    const controller = createController();
    const execute = async (): Promise<BookingTransactionQuoteResult> => {
      if (!isCurrent()) return currentFailure();
      let cleanup: ReturnType<typeof clearRetiredState>;
      try {
        cleanup = clearRetiredState();
      } catch {
        return { status: "blocked", reason: "retired-state-cleanup" };
      }
      if (cleanup.status !== "cleared") {
        return {
          status: "blocked",
          reason:
            cleanup.status === "storage-error"
              ? "storage-unavailable"
              : "retired-state-cleanup",
        };
      }
      if (!isCurrent()) return currentFailure();

      const namespace = journal.prepareQuotedCreate({
        owner: scope.subject,
        isCurrent,
      });
      if (namespace.status !== "ready") {
        if (namespace.status === "stale") return currentFailure();
        if (namespace.status === "storage-error") {
          return { status: "blocked", reason: "storage-unavailable" };
        }
        return {
          status: "blocked",
          reason:
            namespace.reason === "active-journal" ||
            namespace.reason === "foreign-journal" ||
            namespace.reason === "opaque-v2-state"
              ? "recovery-required"
              : "persistence-unavailable",
        };
      }
      if (!isCurrent()) return currentFailure();

      let flowId: string;
      try {
        flowId = createUuid();
      } catch {
        return { status: "blocked", reason: "cryptography-unavailable" };
      }
      if (!isBookingPaymentUuid(flowId)) {
        return { status: "blocked", reason: "cryptography-unavailable" };
      }
      const preparedHandle = freezeHandle(flowId, {
        kind: "accommodation",
        accommodationId: intent.accommodationId,
      });
      if (
        !safeCheck(() => input.publishPreparedHandle(preparedHandle)) ||
        !isCurrent()
      ) {
        return { status: "blocked", reason: "persistence-unavailable" };
      }

      try {
        const response = await dependencies.bookingApi.createQuote(
          {
            accommodationId: intent.accommodationId,
            checkInDate: intent.checkIn,
            checkOutDate: intent.checkOut,
            guestCount: intent.adultCount + intent.childCount,
            couponId: intent.couponId,
          },
          { signal: controller.signal },
        );
        if (!isCurrent()) return currentFailure();

        const written = journal.createQuoted({
          owner: scope.subject,
          lease: toRuntimeLease(scope),
          flowId,
          serverIntent: {
            accommodationId: intent.accommodationId,
            checkInDate: intent.checkIn,
            checkOutDate: intent.checkOut,
            guestCount: intent.adultCount + intent.childCount,
            couponId: intent.couponId,
          },
          presentationIntent: {
            adultCount: intent.adultCount,
            childCount: intent.childCount,
            infantCount: intent.infantCount,
            petCount: intent.petCount,
          },
          quote: { ...response },
          isCurrent,
        });
        if (written.status === "written") {
          return {
            status: "quoted",
            handle: handleForData(written.record.data),
            snapshot: toSnapshot(written.record.data),
          };
        }
        if (written.status === "stale") return currentFailure();
        if (
          written.status === "rejected" &&
          [
            "active-journal",
            "existing-journal",
            "foreign-journal",
            "opaque-v2-state",
          ].includes(written.reason)
        ) {
          return { status: "blocked", reason: "recovery-required" };
        }
        return {
          status: "blocked",
          reason:
            written.status === "storage-error"
              ? "storage-unavailable"
              : "persistence-unavailable",
        };
      } catch (error) {
        if (!isCurrent()) return currentFailure();
        const failure = toRequestFailure(error);
        return isDefinitiveQuoteFailure(error)
          ? { status: "definitive-failure", failure }
          : { status: "retryable-error", stage: "quote", failure };
      }
    };

    const pending = Promise.resolve()
      .then(execute)
      .finally(() => {
        releaseController(controller);
        if (activeQuote?.promise === pending) activeQuote = null;
      });
    activeQuote = { key, promise: pending };
    return pending;
  };

  const load = (
    input: BookingTransactionAuthorityInput,
  ): BookingTransactionLoadResult => {
    // Loading alone may bridge the one crash window where checkout has
    // persisted Ready but history still owns this exact flow's accommodation
    // locator. Mutation commands never opt into this promotion.
    const authority = resolveAuthority(input, true);
    if (authority.status !== "found") return authority;
    return {
      status: "ready",
      handle: handleForData(authority.record.data),
      snapshot: toSnapshot(authority.record.data),
    };
  };

  const checkout = (
    input: BookingTransactionAuthorityInput,
  ): Promise<BookingTransactionCheckoutResult> => {
    if (disposed) {
      return Promise.resolve({ status: "locked", terminal: "disposed" });
    }
    if (!isValidHandle(input.handle)) {
      return Promise.resolve({
        status: "blocked",
        reason: "invalid-authority",
      });
    }
    const key = handleKey(input.handle);
    if (activeCheckout) {
      return activeCheckout.key === key
        ? activeCheckout.promise
        : Promise.resolve({ status: "busy" });
    }

    const controller = createController();
    const execute = async (): Promise<BookingTransactionCheckoutResult> => {
      const authority = resolveAuthority(input);
      if (authority.status !== "found") return authority;
      let data = authority.record.data;

      if (
        data.phase !== "quoted" &&
        data.phase !== "checkout-prepared" &&
        data.phase !== "checkout-submitting"
      ) {
        return {
          status: "current",
          handle: handleForData(data),
          snapshot: toSnapshot(data),
        };
      }

      if (data.quote.amount > 0 && data.quote.currency !== "KRW") {
        return {
          status: "unsupported-payment",
          reason: "currency",
          handle: handleForData(data),
          snapshot: toSnapshot(data),
        };
      }
      if (
        data.quote.amount > 0 &&
        !isSupportedBookingPaymentCardAmount(data.quote.amount)
      ) {
        return {
          status: "unsupported-payment",
          reason: "amount",
          handle: handleForData(data),
          snapshot: toSnapshot(data),
        };
      }

      if (data.phase === "quoted") {
        let idempotencyKey: string;
        let requestFingerprint: string;
        try {
          idempotencyKey = createUuid();
          requestFingerprint = await fingerprint(
            exactCheckoutBody(data.quote.quoteUid),
          );
        } catch {
          return { status: "blocked", reason: "persistence-unavailable" };
        }
        if (!authority.isCurrent()) return currentFailure();

        const preparedData: BookingPaymentJournalData = {
          ...data,
          phase: "checkout-prepared",
          checkout: {
            method: "POST",
            resource: EXACT_CHECKOUT_RESOURCE,
            body: { quoteUid: data.quote.quoteUid, requestMessage: null },
            idempotencyKey,
            requestFingerprint,
          },
        };
        const prepared = replacePhase(
          authority,
          input.handle.locator,
          "quoted",
          preparedData,
        );
        if (prepared.status !== "written" && prepared.status !== "unchanged") {
          return mapJournalWriteFailure(
            prepared.status,
            "reason" in prepared ? prepared.reason : undefined,
          );
        }
        if (!authority.isCurrent()) return currentFailure();
        data =
          prepared.status === "written" ? prepared.record.data : preparedData;
      }

      if (data.phase === "checkout-prepared") {
        const submittingData: BookingPaymentJournalData = {
          ...data,
          phase: "checkout-submitting",
        };
        const submitting = replacePhase(
          authority,
          input.handle.locator,
          "checkout-prepared",
          submittingData,
        );
        if (
          submitting.status !== "written" &&
          submitting.status !== "unchanged"
        ) {
          return mapJournalWriteFailure(
            submitting.status,
            "reason" in submitting ? submitting.reason : undefined,
          );
        }
        if (!authority.isCurrent()) return currentFailure();
        data =
          submitting.status === "written"
            ? submitting.record.data
            : submittingData;
      }
      if (data.phase !== "checkout-submitting") {
        return { status: "blocked", reason: "persistence-unavailable" };
      }

      let response: ReservationReady;
      try {
        response = await dependencies.bookingApi.checkout(
          {
            quote: toReservationQuote(data),
            idempotencyKey: data.checkout.idempotencyKey,
          },
          { signal: controller.signal },
        );
      } catch (error) {
        if (!authority.isCurrent()) return currentFailure();
        const failure = toRequestFailure(error);
        if (CHECKOUT_CONFLICT_CODES.has(failure.code)) {
          return {
            status: "conflict",
            code: failure.code as "R016" | "R020",
          };
        }
        if (DEFINITIVE_UNHELD_CODES.has(failure.code)) {
          const closed = journal.closeUnheldFlow({
            owner: authority.scope.subject,
            lease: toRuntimeLease(authority.scope),
            flowId: data.flowId,
            locator: input.handle.locator,
            closeReason: {
              type: "checkout-definitively-rejected",
              code: failure.code as "R017" | "R018" | "R019",
            },
            isCurrent: authority.isCurrent,
          });
          if (closed.status === "cleared") {
            return { status: "definitive-failure", failure };
          }
          return mapJournalWriteFailure(
            closed.status,
            "reason" in closed ? closed.reason : undefined,
          );
        }
        return { status: "retryable-error", stage: "checkout", failure };
      }
      if (!authority.isCurrent()) return currentFailure();

      const ready = toReady(response);
      let nextPhase:
        | "complimentary-observed"
        | "reservation-ready"
        | "reservation-status-observed";
      if (
        ready.amount === 0 &&
        ready.status === "CONFIRMED" &&
        !ready.paymentRequired &&
        !ready.paymentAllowed &&
        ready.holdExpiresAt === null
      ) {
        nextPhase = "complimentary-observed";
      } else if (
        ready.status === "PAYMENT_PENDING" &&
        ready.paymentRequired &&
        ready.paymentAllowed &&
        ready.holdExpiresAt !== null
      ) {
        nextPhase = "reservation-ready";
      } else {
        nextPhase = "reservation-status-observed";
      }
      const nextData = {
        ...data,
        phase: nextPhase,
        ready,
      } as BookingPaymentJournalData;
      const persisted = replacePhase(
        authority,
        input.handle.locator,
        "checkout-submitting",
        nextData,
      );
      if (persisted.status !== "written" && persisted.status !== "unchanged") {
        return mapJournalWriteFailure(
          persisted.status,
          "reason" in persisted ? persisted.reason : undefined,
        );
      }
      if (!authority.isCurrent()) return currentFailure();
      const persistedData =
        persisted.status === "written" ? persisted.record.data : nextData;
      return {
        status:
          nextPhase === "complimentary-observed"
            ? "complimentary"
            : nextPhase === "reservation-ready"
              ? "payment-ready"
              : "reservation-status",
        handle: handleForData(persistedData),
        snapshot: toSnapshot(persistedData),
      };
    };

    const pending = Promise.resolve()
      .then(execute)
      .finally(() => {
        releaseController(controller);
        if (activeCheckout?.promise === pending) activeCheckout = null;
      });
    activeCheckout = { key, promise: pending };
    return pending;
  };

  const prepareGateway = (
    input: BookingTransactionAuthorityInput,
  ): Promise<BookingTransactionPrepareResult> => {
    if (disposed) {
      return Promise.resolve({ status: "locked", terminal: "disposed" });
    }
    if (!isValidHandle(input.handle)) {
      return Promise.resolve({
        status: "blocked",
        reason: "invalid-authority",
      });
    }
    const key = handleKey(input.handle);
    if (activePrepare) {
      return activePrepare.key === key
        ? activePrepare.promise
        : Promise.resolve({ status: "busy" });
    }

    const execute = async (): Promise<BookingTransactionPrepareResult> => {
      const authority = resolveAuthority(input);
      if (authority.status !== "found") return authority;
      if (
        authority.record.data.phase !== "reservation-ready" &&
        authority.record.data.phase !== "attempt-requesting" &&
        authority.record.data.phase !== "attempt-ready"
      ) {
        return { status: "blocked", reason: "invalid-authority" };
      }
      try {
        await dependencies.gateway.prepare();
        return authority.isCurrent() ? { status: "ready" } : currentFailure();
      } catch (error) {
        if (!authority.isCurrent()) return currentFailure();
        return { status: "gateway-error", error: toSafeGatewayError(error) };
      }
    };

    const pending = Promise.resolve()
      .then(execute)
      .finally(() => {
        if (activePrepare?.promise === pending) activePrepare = null;
      });
    activePrepare = { key, promise: pending };
    return pending;
  };

  const runPay = async (
    input: BookingTransactionPayInput,
  ): Promise<BookingTransactionPayResult> => {
    if (!isValidPayInput(input)) return { status: "invalid-payment-request" };
    const authority = resolveAuthority(input);
    if (authority.status !== "found") return authority;
    let data = authority.record.data;
    if (
      data.phase !== "reservation-ready" &&
      data.phase !== "attempt-requesting" &&
      data.phase !== "attempt-ready"
    ) {
      return { status: "not-payable" };
    }
    if (
      !isNonBlankBoundedText(data.ready.orderName, 100) ||
      !callbackUrlsMatchReservation(input, data.ready.reservationUid)
    ) {
      return { status: "invalid-payment-request" };
    }

    const reservationLocator: BookingPaymentRecoveryLocator = {
      kind: "reservation",
      reservationUid: data.ready.reservationUid,
    };
    if (data.phase === "reservation-ready") {
      const requestingData: BookingPaymentJournalData = {
        ...data,
        phase: "attempt-requesting",
      };
      const requesting = replacePhase(
        authority,
        reservationLocator,
        "reservation-ready",
        requestingData,
      );
      if (
        requesting.status !== "written" &&
        requesting.status !== "unchanged"
      ) {
        return mapJournalWriteFailure(
          requesting.status,
          "reason" in requesting ? requesting.reason : undefined,
        );
      }
      if (!authority.isCurrent()) return currentFailure();
      data =
        requesting.status === "written"
          ? requesting.record.data
          : requestingData;
    }

    if (data.phase === "attempt-requesting") {
      const controller = createController();
      let response: PaymentAttempt;
      try {
        response = await dependencies.paymentApi.beginPaymentAttempt(
          data.ready.reservationUid,
          { signal: controller.signal },
        );
      } catch (error) {
        releaseController(controller);
        if (!authority.isCurrent()) return currentFailure();
        const failure = toRequestFailure(error);
        return ATTEMPT_UNAVAILABLE_CODES.has(failure.code)
          ? { status: "attempt-unavailable", failure }
          : { status: "retryable-error", stage: "attempt", failure };
      }
      releaseController(controller);
      if (!authority.isCurrent()) return currentFailure();

      const readyData: BookingPaymentJournalData = {
        ...data,
        phase: "attempt-ready",
        attempt: toAttempt(response),
      };
      const persisted = replacePhase(
        authority,
        reservationLocator,
        "attempt-requesting",
        readyData,
      );
      if (persisted.status !== "written" && persisted.status !== "unchanged") {
        return mapJournalWriteFailure(
          persisted.status,
          "reason" in persisted ? persisted.reason : undefined,
        );
      }
      if (!authority.isCurrent()) return currentFailure();
      data = persisted.status === "written" ? persisted.record.data : readyData;
    }
    if (data.phase !== "attempt-ready") return { status: "not-payable" };

    if (data.attempt.remainingSeconds === 0) {
      // The backend may legitimately replay the exact attempt with a
      // sub-second hold window. Keep that durable attempt for release/status
      // recovery, but never hand an unusable attempt to Toss.
      return {
        status: "attempt-unavailable",
        failure: { code: "R022", retryable: false },
      };
    }

    const nextHandle = handleForData(data);
    const snapshot = toSnapshot(data);
    const request: PaymentGatewayRequest = {
      orderId: data.attempt.orderId,
      orderName: data.ready.orderName,
      successUrl: input.successUrl,
      failUrl: input.failUrl,
      customerEmail: input.customer.email,
      customerName: input.customer.name,
      amount: data.attempt.amount,
    };

    try {
      // Deliberately invoke the gateway in this same turn as the verified
      // attempt-ready write. There is no intervening network await.
      const gatewayRequest = dependencies.gateway.requestPayment(request);
      await gatewayRequest;
      return authority.isCurrent()
        ? {
            status: "gateway-requested",
            handle: nextHandle,
            snapshot,
          }
        : currentFailure();
    } catch (error) {
      if (!authority.isCurrent()) return currentFailure();
      const safeError = toSafeGatewayError(error);
      return {
        status:
          safeError.kind === "cancelled"
            ? "gateway-cancelled"
            : "gateway-error",
        error: safeError,
        handle: nextHandle,
        snapshot,
      };
    }
  };

  const pay = (
    input: BookingTransactionPayInput,
  ): Promise<BookingTransactionPayResult> => {
    if (disposed) {
      return Promise.resolve({ status: "locked", terminal: "disposed" });
    }
    if (!isValidHandle(input.handle)) {
      return Promise.resolve({
        status: "blocked",
        reason: "invalid-authority",
      });
    }
    const key = handleKey(input.handle);
    if (commandLane) {
      return commandLane.kind === "pay" && commandLane.key === key
        ? commandLane.promise
        : Promise.resolve({ status: "busy" });
    }
    const pending = Promise.resolve()
      .then(() => runPay(input))
      .finally(() => {
        if (commandLane?.kind === "pay" && commandLane.promise === pending) {
          commandLane = null;
        }
      });
    commandLane = { kind: "pay", key, promise: pending };
    return pending;
  };

  const runRelease = async (
    input: BookingTransactionAuthorityInput,
  ): Promise<BookingTransactionReleaseResult> => {
    const authority = resolveAuthority(input);
    if (authority.status !== "found") return authority;
    let data = authority.record.data;
    if (
      data.phase !== "reservation-ready" &&
      data.phase !== "attempt-requesting" &&
      data.phase !== "attempt-ready" &&
      data.phase !== "hold-release-requesting"
    ) {
      return { status: "not-releasable" };
    }

    const locator: BookingPaymentRecoveryLocator = {
      kind: "reservation",
      reservationUid: data.ready.reservationUid,
    };
    if (
      data.phase === "reservation-ready" ||
      data.phase === "attempt-requesting" ||
      data.phase === "attempt-ready"
    ) {
      const expectedPhase = data.phase;
      const requestingData = {
        ...data,
        phase: "hold-release-requesting" as const,
      } as BookingPaymentJournalData;
      const requesting = replacePhase(
        authority,
        locator,
        expectedPhase,
        requestingData,
      );
      if (
        requesting.status !== "written" &&
        requesting.status !== "unchanged"
      ) {
        return mapJournalWriteFailure(
          requesting.status,
          "reason" in requesting ? requesting.reason : undefined,
        );
      }
      if (!authority.isCurrent()) return currentFailure();
      data =
        requesting.status === "written"
          ? requesting.record.data
          : requestingData;
    }
    if (data.phase !== "hold-release-requesting") {
      return { status: "not-releasable" };
    }

    const controller = createController();
    let response: ReservationHoldRelease;
    try {
      response = await dependencies.paymentApi.releaseHold(
        data.ready.reservationUid,
        { signal: controller.signal },
      );
    } catch (error) {
      releaseController(controller);
      if (!authority.isCurrent()) return currentFailure();
      if (isAppError(error) && error.code === "R021") {
        // The backend returns EXPIRED idempotently. R021 therefore proves the
        // reservation has drifted to another non-PAYMENT_PENDING state, but it
        // does not disclose which one. Preserve the journal and let the route
        // converge through the authoritative reservation detail read.
        return { status: "not-releasable" };
      }
      return {
        status: "retryable-error",
        stage: "release",
        failure: toRequestFailure(error),
      };
    }
    releaseController(controller);
    if (!authority.isCurrent()) return currentFailure();
    if (
      response.reservationUid !== data.ready.reservationUid ||
      response.status !== "EXPIRED"
    ) {
      return {
        status: "retryable-error",
        stage: "release",
        failure: { code: "INVALID_RELEASE_RESPONSE", retryable: true },
      };
    }

    const releasedData = {
      ...data,
      phase: "hold-released" as const,
      release: { ...response },
    } as BookingPaymentJournalData;
    const persisted = replacePhase(
      authority,
      locator,
      "hold-release-requesting",
      releasedData,
    );
    if (persisted.status !== "written" && persisted.status !== "unchanged") {
      return mapJournalWriteFailure(
        persisted.status,
        "reason" in persisted ? persisted.reason : undefined,
      );
    }
    if (!authority.isCurrent()) return currentFailure();
    const persistedData =
      persisted.status === "written" ? persisted.record.data : releasedData;
    return {
      status: "released",
      handle: handleForData(persistedData),
      snapshot: toSnapshot(persistedData),
    };
  };

  const releaseHold = (
    input: BookingTransactionAuthorityInput,
  ): Promise<BookingTransactionReleaseResult> => {
    if (disposed) {
      return Promise.resolve({ status: "locked", terminal: "disposed" });
    }
    if (!isValidHandle(input.handle)) {
      return Promise.resolve({
        status: "blocked",
        reason: "invalid-authority",
      });
    }
    const key = handleKey(input.handle);
    if (commandLane) {
      return commandLane.kind === "release" && commandLane.key === key
        ? commandLane.promise
        : Promise.resolve({ status: "busy" });
    }
    const pending = Promise.resolve()
      .then(() => runRelease(input))
      .finally(() => {
        if (
          commandLane?.kind === "release" &&
          commandLane.promise === pending
        ) {
          commandLane = null;
        }
      });
    commandLane = { kind: "release", key, promise: pending };
    return pending;
  };

  const acknowledgeTerminal = (
    input: BookingTransactionAuthorityInput,
  ): BookingTransactionAcknowledgementResult => {
    const authority = resolveAuthority(input);
    if (authority.status !== "found") return authority;
    const terminalPhase = authority.record.data.phase;
    if (
      terminalPhase !== "complimentary-observed" &&
      terminalPhase !== "reservation-status-observed" &&
      terminalPhase !== "hold-released"
    ) {
      return { status: "not-terminal" };
    }

    const result = journal.acknowledgeTerminal({
      owner: authority.scope.subject,
      lease: toRuntimeLease(authority.scope),
      flowId: authority.record.data.flowId,
      locator: input.handle.locator,
      expectedPhase: terminalPhase,
      isCurrent: authority.isCurrent,
    });
    if (result.status === "cleared" || result.status === "missing") {
      return { status: "acknowledged" };
    }
    if (result.status === "stale") return currentFailure();
    if (result.status === "rejected" && result.reason === "not-terminal") {
      return { status: "not-terminal" };
    }
    return mapJournalWriteFailure(
      result.status,
      "reason" in result ? result.reason : undefined,
    );
  };

  const acknowledgeReservationStatusDrift = (
    input: BookingTransactionAuthorityInput & {
      readonly observation: BookingTransactionReservationStatusObservation;
    },
  ): BookingTransactionStatusDriftAcknowledgementResult => {
    const authority = resolveAuthority(input);
    if (authority.status !== "found") return authority;
    const closed = journal.closeReservationStatusDrift({
      owner: authority.scope.subject,
      lease: toRuntimeLease(authority.scope),
      flowId: authority.record.data.flowId,
      locator: input.handle.locator,
      observation: input.observation,
      isCurrent: authority.isCurrent,
    });
    if (closed.status === "cleared") return { status: "acknowledged" };
    if (
      closed.status === "rejected" &&
      (closed.reason === "phase-mismatch" ||
        closed.reason === "invalid-observation")
    ) {
      return { status: "not-converged" };
    }
    return mapJournalAccessFailure(
      closed.status,
      "reason" in closed ? closed.reason : undefined,
    );
  };

  const abandonUnheld = (
    input: BookingTransactionAuthorityInput,
  ): BookingTransactionAbandonResult => {
    const authority = resolveAuthority(input);
    if (authority.status !== "found") return authority;
    if (
      authority.record.data.phase !== "quoted" &&
      authority.record.data.phase !== "checkout-prepared"
    ) {
      return { status: "not-abandonable" };
    }

    const result = journal.closeUnheldFlow({
      owner: authority.scope.subject,
      lease: toRuntimeLease(authority.scope),
      flowId: authority.record.data.flowId,
      locator: input.handle.locator,
      closeReason: { type: "quote-abandoned" },
      isCurrent: authority.isCurrent,
    });
    if (result.status === "cleared") return { status: "abandoned" };
    if (result.status === "stale") return currentFailure();
    return mapJournalWriteFailure(
      result.status,
      "reason" in result ? result.reason : undefined,
    );
  };

  return {
    quote,
    load,
    checkout,
    prepareGateway,
    pay,
    releaseHold,
    acknowledgeTerminal,
    acknowledgeReservationStatusDrift,
    abandonUnheld,
    dispose() {
      if (disposed) return;
      disposed = true;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    },
  };
};
