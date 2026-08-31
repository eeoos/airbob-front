import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import { ReservationConfirmController } from "../../../screens/reservation-confirm/ReservationConfirmController";
import { ReservationConfirmScreen } from "../../../screens/reservation-confirm/ReservationConfirmScreen";
import { useStrictModeSafeDisposable } from "../../../shared/lib/useStrictModeSafeDisposable";
import {
  clearBookingPaymentBrowserState,
  createBookingPaymentCallbackRepository,
  createBookingPaymentCheckoutRepository,
  createTossPaymentsV2GatewayLease,
  type CheckoutData,
} from "../../../workflows/booking-payment/checkout";
import { useSession } from "../../session/useSession";
import { parsePositiveInteger } from "../codecs/queryCodecUtils";
import { routeTo } from "../paths";

type CheckoutResolution =
  | { readonly status: "resolving" }
  | { readonly status: "ready"; readonly checkout: CheckoutData }
  | { readonly status: "invalid" };

function ReservationConfirmRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const sessionEpoch = session.state.epoch;
  const sessionSubject =
    session.state.status === "authenticated" ? session.state.subject : null;
  const { isCurrentSession } = session;
  const accommodationId = parsePositiveInteger(id ?? null, 0) || null;
  const [resolution, setResolution] = useState<CheckoutResolution>({
    status: "resolving",
  });
  const scope = useMemo(
    () =>
      sessionSubject !== null
        ? {
            epoch: sessionEpoch,
            subject: sessionSubject,
          }
        : null,
    [sessionEpoch, sessionSubject],
  );
  const checkoutRepository = useMemo(
    () =>
      createBookingPaymentCheckoutRepository({
        getEpoch: () => sessionEpoch,
      }),
    [sessionEpoch],
  );
  const callbackRepository = useMemo(
    () =>
      createBookingPaymentCallbackRepository({
        getEpoch: () => sessionEpoch,
      }),
    [sessionEpoch],
  );
  const paymentGatewayLease = useMemo(
    () => createTossPaymentsV2GatewayLease(),
    [],
  );
  useStrictModeSafeDisposable(paymentGatewayLease);
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

  useEffect(() => {
    if (accommodationId === null) {
      navigate(routeTo.home(), { replace: true });
      return;
    }
    if (scope === null) return;

    let active = true;
    const isCurrent = () =>
      active && routeLease.isCurrent() && isCurrentSession(scope);
    const consumeHistoryState = () => {
      if (location.state === null || location.state === undefined) return;
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
        { replace: true, state: null },
      );
    };
    const publishReady = (checkout: CheckoutData) => {
      if (!isCurrent()) return;
      consumeHistoryState();
      setResolution({ status: "ready", checkout });
    };
    const rejectCheckout = () => {
      if (!isCurrent()) return;
      clearBookingPaymentBrowserState();
      setResolution({ status: "invalid" });
      // Reservation creation precedes the checkout handoff. When that handoff
      // is missing or unusable, send the guest to their server-owned trips
      // instead of inviting a second reservation command from the detail page.
      navigate(routeTo.profile(), { replace: true });
    };
    const rejectRouteMismatch = () => {
      if (!isCurrent()) return;
      setResolution({ status: "invalid" });
      navigate(routeTo.accommodationDetail(accommodationId), {
        replace: true,
      });
    };
    const resolveCheckout = (checkout: CheckoutData) => {
      if (!isCurrent()) return;
      if (checkout.accommodationId !== accommodationId) {
        // A direct URL for another accommodation must not discard or charge
        // the active checkout owned by that other route.
        rejectRouteMismatch();
        return;
      }

      const callback = callbackRepository.read({
        scope,
        operationId: checkout.operationId,
      });
      if (!isCurrent()) return;
      if (callback.status === "missing") {
        publishReady(checkout);
        return;
      }
      if (
        callback.status === "found" &&
        callback.data.reservationUid === checkout.reservationUid &&
        callback.data.orderId === checkout.reservationUid &&
        callback.data.amount === checkout.amount
      ) {
        // Once a callback exists, payment may already have reached the server.
        // Recovery must reconcile and can never request payment again.
        setResolution({ status: "invalid" });
        navigate(
          routeTo.paymentFail(checkout.reservationUid, {
            reason: "confirm-failed",
          }),
          { replace: true, state: null },
        );
        return;
      }

      if (callback.status === "found") {
        rejectCheckout();
        return;
      }

      // An unreadable or different-operation callback may represent another
      // active recovery. Block this request without deleting unrelated state.
      rejectRouteMismatch();
    };

    const owned = checkoutRepository.read({
      scope,
      accommodationId,
      locationState: location.state,
    });
    if (owned.status === "found") {
      resolveCheckout(owned.data);
      return () => {
        active = false;
      };
    }
    if (
      owned.status === "rejected" &&
      (owned.reason === "invalid-handoff" ||
        owned.reason === "operation-mismatch" ||
        owned.reason === "accommodation-mismatch")
    ) {
      // A current checkout may belong to another route or newer history entry.
      // Preserve it while rejecting only this navigation.
      rejectRouteMismatch();
    } else {
      // Confirmation accepts only the current versioned document, optionally
      // joined to its exact handoff. Missing, unreadable, or retired state is
      // never upgraded and never triggers a backend ownership/payment lookup.
      rejectCheckout();
    }

    return () => {
      active = false;
    };
  }, [
    accommodationId,
    callbackRepository,
    checkoutRepository,
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
    routeLease,
    scope,
    isCurrentSession,
  ]);

  if (
    resolution.status !== "ready" ||
    scope === null ||
    session.state.status !== "authenticated"
  ) {
    return (
      <ReservationConfirmScreen
        errorMessage={null}
        onClearError={() => undefined}
        onConfirmPayment={() => undefined}
        paymentStatus="loading"
        state={{ status: "loading" }}
      />
    );
  }

  const origin = browserWindowNavigation.getOrigin();
  const reservationUid = resolution.checkout.reservationUid;

  return (
    <ReservationConfirmController
      checkout={resolution.checkout}
      customer={{
        email: session.state.viewer.email,
        name: session.state.viewer.nickname,
      }}
      failUrl={`${origin}${routeTo.paymentFail(reservationUid)}`}
      gateway={paymentGatewayLease.gateway}
      resolveImageUrl={resolveImageUrl}
      routeLease={routeLease}
      scope={scope}
      session={session}
      successUrl={`${origin}${routeTo.paymentSuccess(reservationUid)}`}
    />
  );
}

export default ReservationConfirmRoute;
