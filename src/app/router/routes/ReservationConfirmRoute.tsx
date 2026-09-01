import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { reservationBookingApi } from "../../../features/reservations/booking/public";
import { paymentApi } from "../../../features/reservations/payment/public";
import {
  createReservationReadQueryCacheProjection,
  reservationReadApi,
} from "../../../features/reservations/public";
import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import { ReservationConfirmController } from "../../../screens/reservation-confirm/ReservationConfirmController";
import { ReservationConfirmScreen } from "../../../screens/reservation-confirm/ReservationConfirmScreen";
import { useStrictModeSafeDisposable } from "../../../shared/lib/useStrictModeSafeDisposable";
import { createTossPaymentsV2GatewayLease } from "../../../workflows/booking-payment/checkout";
import {
  createBookingTransactionWorkflow,
  type BookingTransactionHandle,
  type BookingTransactionSnapshot,
} from "../../../workflows/booking-payment/transaction/booking";
import { useSession } from "../../session/useSession";
import { bookingPaymentStateCodec } from "../codecs/bookingPaymentStateCodec";
import { parsePositiveInteger } from "../codecs/queryCodecUtils";
import { routeTo } from "../paths";

type CheckoutResolution =
  | { readonly status: "resolving" }
  | {
      readonly status: "ready";
      readonly handle: BookingTransactionHandle;
      readonly snapshot: BookingTransactionSnapshot;
    }
  | { readonly status: "invalid" };

const isConfirmablePhase = (phase: BookingTransactionSnapshot["phase"]) =>
  phase === "reservation-ready" ||
  phase === "attempt-requesting" ||
  phase === "attempt-ready" ||
  phase === "hold-release-requesting" ||
  phase === "hold-released";

function ReservationConfirmRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const sessionEpoch = session.state.epoch;
  const sessionSubject =
    session.state.status === "authenticated" ? session.state.subject : null;
  const { captureAuthenticatedSession, isCurrentSession } = session;
  const accommodationId = parsePositiveInteger(id ?? null, 0) || null;
  const [resolution, setResolution] = useState<CheckoutResolution>({
    status: "resolving",
  });
  const scope = useMemo(() => {
    const captured = captureAuthenticatedSession();
    return captured?.epoch === sessionEpoch &&
      captured.subject === sessionSubject &&
      isCurrentSession(captured)
      ? captured
      : null;
  }, [
    captureAuthenticatedSession,
    isCurrentSession,
    sessionEpoch,
    sessionSubject,
  ]);
  const workflowSession = useMemo(
    () => ({ captureAuthenticatedSession, isCurrentSession }),
    [captureAuthenticatedSession, isCurrentSession],
  );
  const gatewayLease = useMemo(() => createTossPaymentsV2GatewayLease(), []);
  useStrictModeSafeDisposable(gatewayLease);
  const workflow = useMemo(
    () =>
      createBookingTransactionWorkflow({
        bookingApi: reservationBookingApi,
        gateway: gatewayLease.gateway,
        paymentApi,
        session: workflowSession,
      }),
    [gatewayLease.gateway, workflowSession],
  );
  useStrictModeSafeDisposable(workflow);
  const publication = useMemo(
    () => createReservationReadQueryCacheProjection(queryClient),
    [queryClient],
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
  const flowReference = useMemo(
    () => bookingPaymentStateCodec.parseFlowReference(location.state),
    [location.state],
  );

  useEffect(() => {
    if (accommodationId === null) {
      navigate(routeTo.home(), { replace: true, state: null });
      return;
    }
    if (scope === null) return;
    if (!flowReference || flowReference.locator.kind !== "reservation") {
      setResolution({ status: "invalid" });
      navigate(routeTo.profile(), { replace: true, state: null });
      return;
    }

    const handle: BookingTransactionHandle = {
      flowId: flowReference.flowId,
      locator: flowReference.locator,
    };
    const loaded = workflow.load({ handle, routeLease });
    if (
      loaded.status !== "ready" ||
      loaded.snapshot.accommodationId !== accommodationId ||
      loaded.snapshot.reservationUid !== flowReference.locator.reservationUid ||
      !isConfirmablePhase(loaded.snapshot.phase)
    ) {
      setResolution({ status: "invalid" });
      navigate(
        routeTo.reservationDetail(flowReference.locator.reservationUid),
        { replace: true, state: null },
      );
      return;
    }

    setResolution({
      status: "ready",
      handle: loaded.handle,
      snapshot: loaded.snapshot,
    });
  }, [accommodationId, flowReference, navigate, routeLease, scope, workflow]);

  const completeReleasedReservation = useCallback(
    async (
      handle: BookingTransactionHandle,
      snapshot: BookingTransactionSnapshot,
      commandRouteLease: { isCurrent(): boolean },
    ): Promise<boolean> => {
      const captured = captureAuthenticatedSession();
      if (
        snapshot.phase !== "hold-released" ||
        snapshot.reservationUid === null ||
        handle.locator.kind !== "reservation" ||
        handle.locator.reservationUid !== snapshot.reservationUid ||
        !captured ||
        !commandRouteLease.isCurrent() ||
        !isCurrentSession(captured)
      ) {
        return false;
      }
      try {
        await publication.guestReservationChanged({
          reservationUid: snapshot.reservationUid,
          scope: captured,
        });
      } catch {
        return false;
      }
      if (!commandRouteLease.isCurrent() || !isCurrentSession(captured)) {
        return false;
      }
      const acknowledged = workflow.acknowledgeTerminal({
        handle,
        routeLease: commandRouteLease,
      });
      if (acknowledged.status !== "acknowledged") return false;
      navigate(routeTo.reservationDetail(snapshot.reservationUid), {
        replace: true,
        state: null,
      });
      return true;
    },
    [
      captureAuthenticatedSession,
      isCurrentSession,
      navigate,
      publication,
      workflow,
    ],
  );

  const convergeReservationStatus = useCallback(
    async (
      handle: BookingTransactionHandle,
      snapshot: BookingTransactionSnapshot,
      commandRouteLease: { isCurrent(): boolean },
    ): Promise<boolean> => {
      const captured = captureAuthenticatedSession();
      if (
        snapshot.reservationUid === null ||
        handle.locator.kind !== "reservation" ||
        handle.locator.reservationUid !== snapshot.reservationUid ||
        !captured ||
        !commandRouteLease.isCurrent() ||
        !isCurrentSession(captured)
      ) {
        return false;
      }
      try {
        const detail = await reservationReadApi.getDetail(
          "guest",
          snapshot.reservationUid,
        );
        if (
          detail.audience !== "guest" ||
          detail.reservationUid !== snapshot.reservationUid ||
          !commandRouteLease.isCurrent() ||
          !isCurrentSession(captured)
        ) {
          return false;
        }
        await publication.guestReservationChanged({
          reservationUid: snapshot.reservationUid,
          scope: captured,
        });
        if (!commandRouteLease.isCurrent() || !isCurrentSession(captured)) {
          return false;
        }
        const acknowledged = workflow.acknowledgeReservationStatusDrift({
          handle,
          routeLease: commandRouteLease,
          observation: {
            reservationUid: detail.reservationUid,
            status: detail.status,
            paymentAllowed: detail.paymentAllowed,
            holdExpiresAt: detail.holdExpiresAt,
            serverTime: detail.serverTime,
          },
        });
        if (acknowledged.status !== "acknowledged") return false;
      } catch {
        return false;
      }
      if (!commandRouteLease.isCurrent() || !isCurrentSession(captured)) {
        return false;
      }
      navigate(routeTo.reservationDetail(snapshot.reservationUid), {
        replace: true,
        state: null,
      });
      return true;
    },
    [
      captureAuthenticatedSession,
      isCurrentSession,
      navigate,
      publication,
      workflow,
    ],
  );

  if (
    resolution.status !== "ready" ||
    scope === null ||
    session.state.status !== "authenticated"
  ) {
    return (
      <ReservationConfirmScreen
        canReleaseHold={false}
        errorMessage={null}
        isReleasing={false}
        onClearError={() => undefined}
        onConfirmPayment={() => undefined}
        onReleaseHold={() => undefined}
        paymentStatus="loading"
        state={{ status: "loading" }}
      />
    );
  }

  const origin = browserWindowNavigation.getOrigin();
  const reservationUid = resolution.snapshot.reservationUid;
  if (reservationUid === null) return null;

  return (
    <ReservationConfirmController
      customer={{
        email: session.state.viewer.email,
        name: session.state.viewer.nickname,
      }}
      failUrl={`${origin}${routeTo.paymentFail(reservationUid)}`}
      handle={resolution.handle}
      onReleased={completeReleasedReservation}
      onReservationStatusDrift={convergeReservationStatus}
      resolveImageUrl={resolveImageUrl}
      routeLease={routeLease}
      scope={scope}
      snapshot={resolution.snapshot}
      successUrl={`${origin}${routeTo.paymentSuccess(reservationUid)}`}
      workflow={workflow}
    />
  );
}

export default ReservationConfirmRoute;
