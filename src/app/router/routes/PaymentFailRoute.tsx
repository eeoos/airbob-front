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
import { createReservationReadQueryCacheProjection } from "../../../features/reservations/public";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import { PaymentResultController } from "../../../screens/payment-result/PaymentResultController";
import { PaymentResultScreen } from "../../../screens/payment-result/PaymentResultScreen";
import {
  clearBookingPaymentBrowserState,
  createBookingPaymentCallbackRepository,
  createBookingPaymentCheckoutRepository,
  type CallbackData,
  type CallbackPhase,
} from "../../../workflows/booking-payment/checkout";
import {
  toPaymentCallbackDocument,
  type PaymentCallbackDocument,
} from "../../../workflows/booking-payment/confirmation";
import { useSession } from "../../session/useSession";
import { paymentCodec } from "../codecs/paymentCodec";
import { routeTo } from "../paths";

type FailureResolution =
  | { readonly status: "resolving" }
  | {
      readonly status: "ready";
      readonly leaseKey: string;
      readonly callback: CallbackData;
      readonly document: PaymentCallbackDocument;
    }
  | { readonly status: "empty" };

const isExactPaymentTuple = (
  reservationUid: string,
  checkout: Parameters<typeof toPaymentCallbackDocument>[0],
  callback: CallbackData,
): boolean =>
  checkout.reservationUid === reservationUid &&
  callback.operationId === checkout.operationId &&
  callback.reservationUid === checkout.reservationUid &&
  callback.orderId === checkout.reservationUid &&
  callback.amount === checkout.amount;

const isSameCallbackTuple = (
  expected: CallbackData,
  current: CallbackData,
): boolean =>
  current.operationId === expected.operationId &&
  current.reservationUid === expected.reservationUid &&
  current.orderId === expected.orderId &&
  current.paymentKey === expected.paymentKey &&
  current.amount === expected.amount;

export function PaymentFailRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const session = useSession();
  const sessionEpoch = session.state.epoch;
  const sessionSubject =
    session.state.status === "authenticated" ? session.state.subject : null;
  const { isCurrentSession } = session;
  const reason = paymentCodec.parse(location.search).reason;
  const canonicalPath = reservationUid
    ? routeTo.paymentFail(reservationUid, reason ? { reason } : undefined)
    : routeTo.profile();
  const [resolution, setResolution] = useState<FailureResolution>({
    status: "resolving",
  });
  const [routerSyncPath, setRouterSyncPath] = useState<string | null>(null);
  const claimedLeaseRef = useRef<string | null>(null);
  const scope = useMemo(
    () =>
      sessionSubject !== null
        ? { epoch: sessionEpoch, subject: sessionSubject }
        : null,
    [sessionEpoch, sessionSubject],
  );
  const reservationCache = useMemo(
    () => createReservationReadQueryCacheProjection(queryClient),
    [queryClient],
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
  const resolutionLeaseKey = JSON.stringify([
    scope?.epoch ?? null,
    scope?.subject ?? null,
    reservationUid ?? null,
    reason ?? null,
  ]);
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
    if (scope === null || claimedLeaseRef.current === resolutionLeaseKey) {
      return;
    }
    claimedLeaseRef.current = resolutionLeaseKey;
    setResolution({ status: "resolving" });
    const scrub = () => {
      browserWindowNavigation.replaceCurrentUrl(canonicalPath);
      setRouterSyncPath(canonicalPath);
    };

    if (!reservationUid || reason !== "confirm-failed") {
      const joinedCheckout = reservationUid
        ? repositories.checkout.readForCallback({
            scope,
            reservationUid,
          })
        : null;
      const joinedCallback =
        joinedCheckout?.status === "found"
          ? repositories.callback.read({
              scope,
              operationId: joinedCheckout.data.operationId,
            })
          : null;
      const callbackBelongsToCheckout =
        reservationUid !== undefined &&
        joinedCheckout?.status === "found" &&
        joinedCallback?.status === "found" &&
        isExactPaymentTuple(
          reservationUid,
          joinedCheckout.data,
          joinedCallback.data,
        );
      if (
        joinedCheckout?.status === "found" &&
        callbackBelongsToCheckout &&
        routeLease.isCurrent() &&
        isCurrentSession(scope)
      ) {
        clearBookingPaymentBrowserState();
      }
      scrub();
      setResolution({ status: "empty" });
      return;
    }

    const callback = repositories.callback.read({ scope });
    const checkout = repositories.checkout.readForCallback({
      scope,
      reservationUid,
    });
    const sharesOperation =
      callback.status === "found" &&
      checkout.status === "found" &&
      callback.data.operationId === checkout.data.operationId &&
      callback.data.reservationUid === checkout.data.reservationUid;
    if (
      callback.status !== "found" ||
      checkout.status !== "found" ||
      callback.data.reservationUid !== reservationUid ||
      callback.data.operationId !== checkout.data.operationId ||
      callback.data.amount !== checkout.data.amount
    ) {
      if (
        sharesOperation &&
        routeLease.isCurrent() &&
        isCurrentSession(scope)
      ) {
        clearBookingPaymentBrowserState();
      }
      scrub();
      setResolution({ status: "empty" });
      return;
    }

    scrub();
    setResolution({
      status: "ready",
      leaseKey: resolutionLeaseKey,
      callback: callback.data,
      document: toPaymentCallbackDocument(checkout.data),
    });
  }, [
    canonicalPath,
    navigate,
    reason,
    repositories,
    resolutionLeaseKey,
    reservationUid,
    routeLease,
    scope,
    isCurrentSession,
  ]);

  useEffect(() => {
    if (routerSyncPath === null) return;
    navigate(routerSyncPath, { replace: true, state: null });
    setRouterSyncPath(null);
  }, [navigate, routerSyncPath]);

  const clearDocuments = useCallback(() => {
    if (
      resolution.status !== "ready" ||
      resolution.leaseKey !== resolutionLeaseKey ||
      claimedLeaseRef.current !== resolution.leaseKey ||
      scope === null ||
      !routeLease.isCurrent() ||
      !isCurrentSession(scope)
    ) {
      return;
    }

    const checkout = repositories.checkout.readForCallback({
      scope,
      reservationUid: resolution.callback.reservationUid,
    });
    const callback = repositories.callback.read({
      scope,
      operationId: resolution.callback.operationId,
    });
    if (
      checkout.status === "found" &&
      callback.status === "found" &&
      isExactPaymentTuple(
        resolution.callback.reservationUid,
        checkout.data,
        callback.data,
      ) &&
      isSameCallbackTuple(resolution.callback, callback.data)
    ) {
      clearBookingPaymentBrowserState();
    }
  }, [
    isCurrentSession,
    repositories,
    resolution,
    resolutionLeaseKey,
    routeLease,
    scope,
  ]);

  const finishTerminalFailure = useCallback(() => {
    if (
      resolution.status !== "ready" ||
      claimedLeaseRef.current !== resolution.leaseKey
    ) {
      return;
    }
    clearDocuments();
    setResolution({ status: "empty" });
  }, [clearDocuments, resolution]);

  if (
    resolution.status !== "ready" ||
    scope === null ||
    resolution.leaseKey !== resolutionLeaseKey ||
    reason !== "confirm-failed" ||
    resolution.callback.reservationUid !== reservationUid ||
    resolution.document.reservationUid !== reservationUid ||
    `${location.pathname}${location.search}` !== canonicalPath
  ) {
    return (
      <PaymentResultScreen
        mode="failure"
        onOpenProfile={() => navigate(routeTo.profile())}
        {...(reservationUid
          ? {
              onOpenReservation: () =>
                navigate(routeTo.reservationDetail(reservationUid)),
            }
          : {})}
      />
    );
  }

  const changeCallbackPhase = (phase: CallbackPhase) =>
    repositories.callback.write({
      scope,
      data: { ...resolution.callback, phase },
      isCurrent: () =>
        claimedLeaseRef.current === resolution.leaseKey &&
        routeLease.isCurrent() &&
        isCurrentSession(scope),
    }).status === "written";

  return (
    <PaymentResultController
      callback={resolution.callback}
      document={resolution.document}
      mode="failure"
      shouldConfirm={resolution.callback.phase === "received"}
      routeLease={routeLease}
      session={session}
      onCallbackPhaseChange={changeCallbackPhase}
      onConfirmed={async () => {
        const confirmedReservationUid = resolution.callback.reservationUid;
        const confirmedLeaseKey = resolution.leaseKey;
        if (
          claimedLeaseRef.current !== confirmedLeaseKey ||
          !routeLease.isCurrent()
        ) {
          return;
        }
        clearDocuments();
        try {
          await reservationCache.guestReservationChanged({
            reservationUid: confirmedReservationUid,
            scope,
          });
        } catch {
          // Cache freshness is best-effort; server payment authority already won.
        }
        if (
          claimedLeaseRef.current === confirmedLeaseKey &&
          routeLease.isCurrent()
        ) {
          navigate(routeTo.reservationDetail(confirmedReservationUid), {
            replace: true,
          });
        }
      }}
      onInvalid={finishTerminalFailure}
      onOpenProfile={() => navigate(routeTo.profile())}
      onOpenReservation={() =>
        navigate(routeTo.reservationDetail(resolution.callback.reservationUid))
      }
      onRecoverable={() => undefined}
      onTerminalFailure={finishTerminalFailure}
    />
  );
}

export default PaymentFailRoute;
