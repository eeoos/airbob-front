import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { invalidateGuestReservationCaches } from "../../../features/reservations/public";
import { checkoutOwnershipApi } from "../../../features/reservations/payment/public";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import { PaymentResultController } from "../../../screens/payment-result/PaymentResultController";
import { PaymentResultScreen } from "../../../screens/payment-result/PaymentResultScreen";
import {
  clearBookingPaymentBrowserState,
  createBookingPaymentCallbackRepository,
  createBookingPaymentCheckoutRepository,
  type CallbackPhase,
} from "../../../workflows/booking-payment/checkout";
import {
  claimPaymentCallback,
  resolveServerPaymentCallbackReplay,
  type PaymentCallbackClaimInvalidReason,
  type PaymentCallbackFreshTuple,
  type PaymentCallbackReady,
} from "../../../workflows/booking-payment/confirmation";
import { useSession } from "../../session/useSession";
import { usePaymentCallbackCredentialClaim } from "../PaymentCallbackCredentialBoundary";
import { routeTo } from "../paths";

type SuccessResolution =
  | { readonly status: "resolving" }
  | PaymentCallbackReady
  | {
      readonly status: "server-replay-required";
      readonly fresh: PaymentCallbackFreshTuple;
    }
  | {
      readonly status: "server-replay-retryable";
      readonly fresh: PaymentCallbackFreshTuple;
      readonly reason: "ownership-unavailable";
    }
  | {
      readonly status: "invalid";
      readonly reason?: PaymentCallbackClaimInvalidReason | "ownership-mismatch";
    }
  | { readonly status: "stale" };

export function PaymentSuccessRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const credentialClaim = usePaymentCallbackCredentialClaim();
  const session = useSession();
  const sessionEpoch = session.state.epoch;
  const sessionSubject =
    session.state.status === "authenticated"
      ? session.state.subject
      : null;
  const { isCurrentSession } = session;
  const [resolution, setResolution] = useState<SuccessResolution>({
    status: "resolving",
  });
  const [ephemeralReplayRecoverable, setEphemeralReplayRecoverable] =
    useState(false);
  const claimedRef = useRef(false);
  const invalidHandledRef = useRef(false);
  const scope = useMemo(
    () =>
      sessionSubject !== null
        ? { epoch: sessionEpoch, subject: sessionSubject }
        : null,
    [sessionEpoch, sessionSubject],
  );
  const repositories = useMemo(
    () => ({
      callback: createBookingPaymentCallbackRepository({
        getEpoch: () => sessionEpoch,
      }),
      checkout: createBookingPaymentCheckoutRepository({
        getEpoch: () => sessionEpoch,
      }),
    }),
    [sessionEpoch],
  );
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

  useLayoutEffect(() => {
    if (
      claimedRef.current ||
      scope === null ||
      location.search !== ""
    ) {
      return;
    }
    claimedRef.current = true;
    const isCurrent = () =>
      routeLease.isCurrent() && isCurrentSession(scope);

    if (!reservationUid || credentialClaim.status === "invalid") {
      setResolution({ status: "invalid" });
      return;
    }
    const fresh =
      credentialClaim.status === "fresh"
        ? credentialClaim.fresh
        : undefined;
    const claimed = claimPaymentCallback(repositories, {
      scope,
      reservationUid,
      ...(fresh ? { fresh } : {}),
      isCurrent,
    });
    if (claimed.status === "stale") return;

    setResolution(claimed);
  }, [
    credentialClaim,
    location.search,
    repositories,
    reservationUid,
    routeLease,
    scope,
    isCurrentSession,
  ]);

  useEffect(() => {
    if (
      resolution.status !== "server-replay-required" ||
      scope === null ||
      location.search !== ""
    ) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    const isCurrent = () =>
      active &&
      routeLease.isCurrent() &&
      isCurrentSession(scope);

    void resolveServerPaymentCallbackReplay(
      { ownershipApi: checkoutOwnershipApi },
      {
        fresh: resolution.fresh,
        signal: controller.signal,
        isCurrent,
      },
    ).then((result) => {
      if (!isCurrent()) return;
      if (result.status !== "stale") setResolution(result);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isCurrentSession, location.search, resolution, routeLease, scope]);

  const clearDocuments = useCallback(() => {
    if (scope === null) return;
    if (routeLease.isCurrent() && isCurrentSession(scope)) {
      clearBookingPaymentBrowserState();
    }
  }, [isCurrentSession, routeLease, scope]);

  const handleInvalid = useCallback((clearJoinedDocuments = false) => {
    if (!reservationUid) {
      navigate(routeTo.profile(), { replace: true, state: null });
      return;
    }
    if (clearJoinedDocuments) clearDocuments();
    navigate(
      routeTo.paymentFail(reservationUid, { reason: "invalid-callback" }),
      { replace: true, state: null },
    );
  }, [clearDocuments, navigate, reservationUid]);

  useEffect(() => {
    if (
      resolution.status !== "invalid" ||
      invalidHandledRef.current ||
      location.search !== ""
    ) {
      return;
    }
    invalidHandledRef.current = true;
    const clearJoinedDocuments =
      resolution.reason === "callback-mismatch" ||
      resolution.reason === "marker-unavailable" ||
      resolution.reason === "callback-write-failed";
    handleInvalid(clearJoinedDocuments);
  }, [handleInvalid, location.search, resolution]);

  if (
    resolution.status === "server-replay-retryable" &&
    scope !== null &&
    location.search === ""
  ) {
    return (
      <PaymentResultScreen
        mode="failure"
        statusMessage="결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요."
        onOpenProfile={() => navigate(routeTo.profile())}
        onReconcile={() =>
          setResolution({
            status: "server-replay-required",
            fresh: resolution.fresh,
          })
        }
      />
    );
  }

  if (
    resolution.status !== "ready" ||
    scope === null ||
    location.search !== ""
  ) {
    return <PaymentResultScreen mode="processing" />;
  }

  const changeCallbackPhase = (phase: CallbackPhase) =>
    resolution.persistCallback
      ? repositories.callback.write({
          scope,
          data: { ...resolution.callback, phase },
          isCurrent: () =>
            routeLease.isCurrent() && isCurrentSession(scope),
        }).status === "written"
      : routeLease.isCurrent() && isCurrentSession(scope);

  return (
    <PaymentResultController
      callback={resolution.callback}
      document={resolution.document}
      mode={ephemeralReplayRecoverable ? "failure" : "success"}
      shouldConfirm={resolution.shouldConfirm}
      routeLease={routeLease}
      session={session}
      onCallbackPhaseChange={changeCallbackPhase}
      onConfirmed={async () => {
        const confirmedReservationUid = resolution.callback.reservationUid;
        clearDocuments();
        try {
          await invalidateGuestReservationCaches(
            queryClient,
            confirmedReservationUid,
          );
        } catch {
          // Cache freshness is best-effort; server payment authority already won.
        }
        if (routeLease.isCurrent()) {
          navigate(routeTo.reservationDetail(confirmedReservationUid), {
            replace: true,
            state: null,
          });
        }
      }}
      onInvalid={() => handleInvalid(resolution.persistCallback)}
      onOpenProfile={() => navigate(routeTo.profile())}
      onRecoverable={() => {
        if (!resolution.persistCallback) {
          // A server-authoritative replay has no browser documents to hand to
          // the fail route. Keep its verified tuple in this route's memory so
          // the user can reconcile again without restoring URL credentials.
          setEphemeralReplayRecoverable(true);
          return;
        }
        navigate(
          routeTo.paymentFail(resolution.callback.reservationUid, {
            reason: "confirm-failed",
          }),
          { replace: true, state: null },
        );
      }}
      onTerminalFailure={() => handleInvalid(resolution.persistCallback)}
    />
  );
}

export default PaymentSuccessRoute;
