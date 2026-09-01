import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { paymentApi } from "../../../features/reservations/payment/public";
import { createReservationReadQueryCacheProjection } from "../../../features/reservations/public";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import {
  PaymentResultController,
  type PaymentRecoveryStart,
} from "../../../screens/payment-result/PaymentResultController";
import { PaymentResultScreen } from "../../../screens/payment-result/PaymentResultScreen";
import { useStrictModeSafeDisposable } from "../../../shared/lib/useStrictModeSafeDisposable";
import { createBookingPaymentJournalRepository } from "../../../workflows/booking-payment/journal";
import {
  createBookingPaymentRecoveryWorkflow,
  type BookingPaymentConfirmationResumeReferenceState,
  type BookingPaymentOperationReference,
} from "../../../workflows/booking-payment/transaction/recovery";
import { useSession } from "../../session/useSession";
import {
  useConsumePendingPaymentCallbackCredential,
  useMarkPaymentRecoveryFence,
  usePaymentCallbackCredentialClaim,
  usePaymentRecoveryFenceStatus,
} from "../PaymentCallbackCredentialBoundary";
import {
  bookingPaymentStateCodec,
  type BookingPaymentFlowReferenceState,
  type BookingPaymentOperationReferenceState,
} from "../codecs/bookingPaymentStateCodec";
import { routeTo } from "../paths";

type StaticResolution =
  | { readonly status: "resolving" }
  | {
      readonly status: "unavailable";
      readonly message: string;
      readonly canRetryCandidateReconciliation: boolean;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readRouterUserState = (): unknown => {
  try {
    const current: unknown = window.history.state;
    return isRecord(current) && "usr" in current ? current.usr : null;
  } catch {
    return null;
  }
};

const replaceRouterUserState = <T,>(
  pathname: string,
  state: T,
  parse: (value: unknown) => T | null,
): T | null => {
  try {
    const current: unknown = window.history.state;
    const next = isRecord(current)
      ? { ...current, usr: state }
      : { usr: state };
    window.history.replaceState(next, "", pathname);
    return parse(readRouterUserState());
  } catch {
    return null;
  }
};

const exactFlowReference = (
  value: BookingPaymentFlowReferenceState | null,
  reservationUid: string | undefined,
): BookingPaymentConfirmationResumeReferenceState | null => {
  if (
    value?.locator.kind !== "reservation" ||
    value.locator.reservationUid !== reservationUid
  ) {
    return null;
  }
  return {
    purpose: value.purpose,
    version: value.version,
    flowId: value.flowId,
    locator: value.locator,
  };
};

const exactOperationReference = (
  value: BookingPaymentOperationReferenceState | null,
  reservationUid: string | undefined,
): BookingPaymentOperationReferenceState | null =>
  value?.reservationUid === reservationUid ? value : null;

function PaymentSuccessRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const credentialClaim = usePaymentCallbackCredentialClaim();
  const consumePendingCallbackCredential =
    useConsumePendingPaymentCallbackCredential();
  const recoveryFenceStatus = usePaymentRecoveryFenceStatus();
  const markRecoveryFence = useMarkPaymentRecoveryFence();
  const session = useSession();
  const [staticResolution, setStaticResolution] = useState<StaticResolution>({
    status: "resolving",
  });
  const [candidateRetryBusy, setCandidateRetryBusy] = useState(false);
  const [localRecoveryStart, setLocalRecoveryStart] = useState<{
    readonly historyKey: string;
    readonly start: PaymentRecoveryStart;
    readonly verifiedFence: boolean;
  } | null>(null);
  const callbackClaimedRef = useRef(false);
  const { captureAuthenticatedSession, isCurrentSession } = session;
  const repository = useMemo(() => createBookingPaymentJournalRepository(), []);
  const routeLease = useMemo(
    () => ({
      isCurrent: () =>
        browserWindowNavigation.isCurrentHistoryEntry({
          hash: location.hash,
          key: location.key,
          pathname: location.pathname,
          search: location.search,
        }),
    }),
    [location.hash, location.key, location.pathname, location.search],
  );
  const workflowSession = useMemo(
    () => ({ captureAuthenticatedSession, isCurrentSession }),
    [captureAuthenticatedSession, isCurrentSession],
  );
  const workflow = useMemo(
    () =>
      createBookingPaymentRecoveryWorkflow({
        api: paymentApi,
        repository,
        routeLease,
        session: workflowSession,
      }),
    [repository, routeLease, workflowSession],
  );
  useStrictModeSafeDisposable(workflow);
  const reservationCache = useMemo(
    () => createReservationReadQueryCacheProjection(queryClient),
    [queryClient],
  );
  const flowReference = useMemo(
    () =>
      exactFlowReference(
        bookingPaymentStateCodec.parseFlowReference(location.state),
        reservationUid,
      ),
    [location.state, reservationUid],
  );
  const operationReference = useMemo(
    () =>
      exactOperationReference(
        bookingPaymentStateCodec.parseOperationReference(location.state),
        reservationUid,
      ),
    [location.state, reservationUid],
  );
  const locationStart = useMemo<PaymentRecoveryStart | null>(() => {
    if (operationReference) {
      return {
        kind: "operation",
        reference: {
          flowId: operationReference.flowId,
          operationId: operationReference.operationId,
          reservationUid: operationReference.reservationUid,
        },
      };
    }
    if (flowReference) {
      return { kind: "confirmation", reference: flowReference };
    }
    return null;
  }, [flowReference, operationReference]);
  const localRecoveryForEntry = useMemo(() => {
    const localReservationUid =
      localRecoveryStart?.start.kind === "confirmation"
        ? localRecoveryStart.start.reference.locator.reservationUid
        : localRecoveryStart?.start.reference.reservationUid;
    return localRecoveryStart?.historyKey === location.key &&
      localReservationUid === reservationUid
      ? localRecoveryStart
      : null;
  }, [localRecoveryStart, location.key, reservationUid]);
  const start = localRecoveryForEntry?.start ?? locationStart;

  const currentCleanPath = `${location.pathname}${location.search}${location.hash}`;

  const publishConfirmationStart = useCallback(
    (
      reference: BookingPaymentConfirmationResumeReferenceState,
      verifiedFence = false,
    ): boolean => {
      if (
        reservationUid === undefined ||
        reference.locator.reservationUid !== reservationUid ||
        !routeLease.isCurrent()
      ) {
        return false;
      }
      const persisted = replaceRouterUserState(
        currentCleanPath,
        reference,
        bookingPaymentStateCodec.parseFlowReference,
      );
      if (
        persisted === null ||
        persisted.flowId !== reference.flowId ||
        persisted.locator.kind !== "reservation" ||
        persisted.locator.reservationUid !== reservationUid
      ) {
        return false;
      }
      setLocalRecoveryStart({
        historyKey: location.key,
        verifiedFence,
        start: {
          kind: "confirmation",
          reference: {
            purpose: persisted.purpose,
            version: persisted.version,
            flowId: persisted.flowId,
            locator: {
              kind: "reservation",
              reservationUid: persisted.locator.reservationUid,
            },
          },
        },
      });
      // The callback tuple now has two credential-free durable recovery
      // anchors: the claimed journal and the read-back history reference.
      // Remove its short-lived memory lease before logout/revocation can occur.
      consumePendingCallbackCredential();
      return true;
    },
    [
      consumePendingCallbackCredential,
      currentCleanPath,
      location.key,
      reservationUid,
      routeLease,
    ],
  );

  useLayoutEffect(() => {
    if (
      location.search !== "" ||
      location.hash !== "" ||
      start !== null ||
      callbackClaimedRef.current
    ) {
      return;
    }

    callbackClaimedRef.current = true;
    if (!reservationUid || credentialClaim.status === "invalid") {
      setStaticResolution({
        status: "unavailable",
        message:
          credentialClaim.status === "invalid"
            ? "결제 콜백 정보가 올바르지 않습니다."
            : "이 화면에서 결제 상태를 확인할 복구 식별자가 없습니다.",
        canRetryCandidateReconciliation:
          recoveryFenceStatus === "recovery-unavailable",
      });
      return;
    }

    if (
      credentialClaim.status === "none" &&
      recoveryFenceStatus === "recovery-unavailable"
    ) {
      setStaticResolution({
        status: "unavailable",
        message: "이전 복구 시도에서 저장된 결제 정보를 확인하지 못했습니다.",
        canRetryCandidateReconciliation: true,
      });
      return;
    }

    const claimed =
      credentialClaim.status === "fresh"
        ? workflow.claimCallback(credentialClaim.fresh)
        : workflow.recoverClaimedCallback(reservationUid);
    if (claimed.status !== "confirmation-ready") {
      setStaticResolution({
        status: "unavailable",
        message:
          claimed.status === "auth-required"
            ? "로그인 상태를 확인한 뒤 다시 시도해주세요."
            : claimed.status === "receipt-authoritative"
              ? "결제 처리는 접수되었지만 이 화면에서 이어서 확인할 수 없습니다."
              : claimed.status === "invalid-callback"
                ? "이 화면에서 결제 상태를 확인할 복구 식별자가 없습니다."
                : "저장된 결제 정보를 안전하게 확인하지 못했습니다.",
        canRetryCandidateReconciliation:
          claimed.status === "retryable" ||
          claimed.status === "recovery-unavailable",
      });
      return;
    }

    if (!publishConfirmationStart(claimed.reference)) {
      setStaticResolution({
        status: "unavailable",
        message: "결제 복구 식별자를 브라우저 히스토리에 저장하지 못했습니다.",
        canRetryCandidateReconciliation: false,
      });
      return;
    }

    // The controller cannot mount (and therefore cannot POST) before the real
    // browser history entry has returned the exact credential-free reference.
  }, [
    credentialClaim,
    currentCleanPath,
    location.hash,
    location.search,
    publishConfirmationStart,
    recoveryFenceStatus,
    reservationUid,
    start,
    workflow,
  ]);

  const persistOperationReference = useCallback(
    (reference: BookingPaymentOperationReference): boolean => {
      if (
        reservationUid === undefined ||
        reference.reservationUid !== reservationUid ||
        !routeLease.isCurrent()
      ) {
        return false;
      }
      const state = bookingPaymentStateCodec.serializeOperationReference(
        reference.flowId,
        reference.operationId,
        reference.reservationUid,
      );
      if (state === null) return false;
      const persisted = replaceRouterUserState(
        currentCleanPath,
        state,
        bookingPaymentStateCodec.parseOperationReference,
      );
      if (
        persisted === null ||
        persisted.flowId !== reference.flowId ||
        persisted.operationId !== reference.operationId ||
        persisted.reservationUid !== reference.reservationUid
      ) {
        return false;
      }
      setLocalRecoveryStart({
        historyKey: location.key,
        verifiedFence: false,
        start: { kind: "operation", reference },
      });
      return true;
    },
    [currentCleanPath, location.key, reservationUid, routeLease],
  );

  const markVerifiedRecovery = useCallback(() => {
    if (recoveryFenceStatus !== "none") markRecoveryFence("none");
  }, [markRecoveryFence, recoveryFenceStatus]);

  const openReservation = useCallback(() => {
    if (reservationUid) navigate(routeTo.reservationDetail(reservationUid));
    else navigate(routeTo.profile());
  }, [navigate, reservationUid]);

  const handleTerminalAcknowledged = useCallback(
    async (reference: BookingPaymentOperationReference) => {
      const scope = captureAuthenticatedSession();
      if (
        scope === null ||
        reference.reservationUid !== reservationUid ||
        !routeLease.isCurrent() ||
        !isCurrentSession(scope)
      ) {
        return;
      }
      try {
        await reservationCache.guestReservationChanged({
          reservationUid: reference.reservationUid,
          scope,
        });
      } catch {
        // The receipt is already acknowledged. Cache invalidation is a
        // best-effort projection and cannot recreate payment authority.
      }
      if (routeLease.isCurrent() && isCurrentSession(scope)) {
        navigate(routeTo.reservationDetail(reference.reservationUid), {
          replace: true,
          state: null,
        });
      }
    },
    [
      captureAuthenticatedSession,
      isCurrentSession,
      navigate,
      reservationCache,
      reservationUid,
      routeLease,
    ],
  );

  const retryCandidateReconciliation = useCallback(() => {
    if (candidateRetryBusy) return;
    const scope = captureAuthenticatedSession();
    if (scope === null || !routeLease.isCurrent() || !isCurrentSession(scope)) {
      return;
    }
    setCandidateRetryBusy(true);
    let result: ReturnType<typeof repository.reconcileCandidateOwner>;
    try {
      result = repository.reconcileCandidateOwner(scope.subject);
    } catch {
      setCandidateRetryBusy(false);
      setStaticResolution({
        status: "unavailable",
        message: "저장된 결제 정보를 아직 확인하지 못했습니다.",
        canRetryCandidateReconciliation: true,
      });
      return;
    }
    if (!routeLease.isCurrent() || !isCurrentSession(scope)) return;
    setCandidateRetryBusy(false);
    if (result.status === "ready") {
      markRecoveryFence("none");
      setStaticResolution({
        status: "unavailable",
        message:
          "복구 상태를 정리했습니다. 예약 상세에서 현재 상태를 확인해주세요.",
        canRetryCandidateReconciliation: false,
      });
      return;
    }
    if (result.status === "recovery-required" && reservationUid) {
      const claimed = workflow.recoverClaimedCallback(reservationUid);
      if (
        claimed.status === "confirmation-ready" &&
        routeLease.isCurrent() &&
        isCurrentSession(scope) &&
        publishConfirmationStart(claimed.reference, true)
      ) {
        markRecoveryFence("none");
        return;
      }
    }
    setStaticResolution({
      status: "unavailable",
      message:
        result.status === "recovery-required"
          ? "결제 복구 정보가 남아 있지만 이 화면에 필요한 식별자가 없습니다."
          : "저장된 결제 정보를 아직 확인하지 못했습니다.",
      canRetryCandidateReconciliation: true,
    });
  }, [
    candidateRetryBusy,
    captureAuthenticatedSession,
    isCurrentSession,
    markRecoveryFence,
    publishConfirmationStart,
    repository,
    reservationUid,
    routeLease,
    workflow,
  ]);

  if (start !== null) {
    return (
      <PaymentResultController
        autoStart={
          recoveryFenceStatus !== "recovery-unavailable" ||
          localRecoveryForEntry?.verifiedFence === true
        }
        onOpenProfile={() => navigate(routeTo.profile())}
        onOpenReservation={openReservation}
        onOperationAccepted={persistOperationReference}
        onRecoveryVerified={markVerifiedRecovery}
        onTerminalAcknowledged={handleTerminalAcknowledged}
        routeLease={routeLease}
        start={start}
        workflow={workflow}
      />
    );
  }

  if (staticResolution.status === "resolving") {
    return <PaymentResultScreen mode="processing" />;
  }

  return (
    <PaymentResultScreen
      mode="recovery-unavailable"
      isBusy={candidateRetryBusy}
      statusMessage={staticResolution.message}
      onOpenProfile={() => navigate(routeTo.profile())}
      {...(reservationUid ? { onOpenReservation: openReservation } : {})}
      {...(staticResolution.canRetryCandidateReconciliation
        ? { onRetry: retryCandidateReconciliation }
        : {})}
    />
  );
}

export default PaymentSuccessRoute;
