import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPath,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { accommodationAmenityCatalog } from "../../../features/accommodations/public";
import { reservationBookingApi } from "../../../features/reservations/booking/public";
import { paymentApi } from "../../../features/reservations/payment/public";
import { createReservationReadQueryCacheProjection } from "../../../features/reservations/public";
import { recentlyViewedApi } from "../../../features/wishlist/public";
import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import {
  AccommodationDetailController,
  type AccommodationDetailAuthIntent,
  type AccommodationDetailClaimedAuthIntent,
} from "../../../screens/accommodation-detail/public";
import { useStrictModeSafeDisposable } from "../../../shared/lib/useStrictModeSafeDisposable";
import {
  toAuthIntentLocalDate,
  useAuthIntent,
  type AuthIntent,
  type AuthIntentAttemptId,
  type ClaimedAuthIntent,
} from "../../../workflows/auth-intent";
import { createTossPaymentsV2GatewayLease } from "../../../workflows/booking-payment/checkout";
import {
  createBookingTransactionWorkflow,
  type BookingTransactionHandle,
  type BookingTransactionSnapshot,
} from "../../../workflows/booking-payment/transaction/booking";
import { useWishlistMembership } from "../../../workflows/wishlist-membership";
import { useSession } from "../../session/useSession";
import { usePaymentRecoveryFenceStatus } from "../PaymentCallbackCredentialBoundary";
import { bookingPaymentStateCodec } from "../codecs/bookingPaymentStateCodec";
import { parsePositiveInteger } from "../codecs/queryCodecUtils";
import { accommodationBookingCodec } from "../codecs/searchCodec";
import { routeTo } from "../paths";
import { WishlistMembershipRouteBoundary } from "./WishlistMembershipRouteBoundary";

const toRuntimeAuthIntent = (
  intent: AccommodationDetailAuthIntent,
): AuthIntent => {
  if (intent.type !== "reservation.start") return intent;

  return {
    ...intent,
    checkIn: toAuthIntentLocalDate(intent.checkIn),
    checkOut: toAuthIntentLocalDate(intent.checkOut),
  };
};

function AccommodationDetailRouteContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const paymentRecoveryFenceStatus = usePaymentRecoveryFenceStatus();
  const { pending, request, cancel, claim } = useAuthIntent();
  const wishlistCommands = useWishlistMembership();
  const requestedAttemptIdRef = useRef<AuthIntentAttemptId | null>(null);
  const [claimedIntent, setClaimedIntent] = useState<ClaimedAuthIntent | null>(
    null,
  );
  const parsedAccommodationId = parsePositiveInteger(id ?? null, 0);
  const accommodationId =
    parsedAccommodationId > 0 ? parsedAccommodationId : null;
  const currentPath = createPath(location);
  const isAuthenticated = session.state.status === "authenticated";
  const sessionEpoch = session.state.epoch;
  const sessionSubject = isAuthenticated ? session.state.subject : null;
  const captureAuthenticatedSession = session.captureAuthenticatedSession;
  const isCurrentSession = session.isCurrentSession;
  const workflowSession = useMemo(
    () => ({ captureAuthenticatedSession, isCurrentSession }),
    [captureAuthenticatedSession, isCurrentSession],
  );
  const bookingRouteState = useMemo(
    () => accommodationBookingCodec.parse(location.search),
    [location.search],
  );
  const scope = useMemo(
    () => ({ epoch: sessionEpoch, subject: sessionSubject }),
    [sessionEpoch, sessionSubject],
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
  const gatewayLease = useMemo(() => createTossPaymentsV2GatewayLease(), []);
  useStrictModeSafeDisposable(gatewayLease);
  const bookingWorkflow = useMemo(
    () =>
      createBookingTransactionWorkflow({
        bookingApi: reservationBookingApi,
        gateway: gatewayLease.gateway,
        paymentApi,
        session: workflowSession,
      }),
    [gatewayLease.gateway, workflowSession],
  );
  useStrictModeSafeDisposable(bookingWorkflow);
  const reservationPublication = useMemo(
    () => createReservationReadQueryCacheProjection(queryClient),
    [queryClient],
  );
  const flowReference = useMemo(
    () => bookingPaymentStateCodec.parseFlowReference(location.state),
    [location.state],
  );
  const flowHandle = useMemo<BookingTransactionHandle | null>(
    () =>
      flowReference
        ? { flowId: flowReference.flowId, locator: flowReference.locator }
        : null,
    [flowReference],
  );

  const requestAuthIntent = useCallback(
    (intent: AccommodationDetailAuthIntent) => {
      if (!accommodationId || intent.accommodationId !== accommodationId) {
        return false;
      }

      try {
        requestedAttemptIdRef.current = request(toRuntimeAuthIntent(intent));
        return true;
      } catch {
        return false;
      }
    },
    [accommodationId, request],
  );

  const cancelPendingAuthIntent = useCallback(() => {
    const attemptId = requestedAttemptIdRef.current;
    requestedAttemptIdRef.current = null;
    if (attemptId !== null) cancel(attemptId);
  }, [cancel]);

  useEffect(() => {
    if (
      session.state.status !== "authenticated" ||
      accommodationId === null ||
      !pending ||
      pending.intent.accommodationId !== accommodationId ||
      pending.source.locationKey !== location.key ||
      pending.source.path !== currentPath
    ) {
      return;
    }

    const claimed = claim(
      (intent) => intent.accommodationId === accommodationId,
    );
    if (!claimed) return;

    if (requestedAttemptIdRef.current === claimed.attemptId) {
      requestedAttemptIdRef.current = null;
    }
    setClaimedIntent(claimed);
  }, [
    accommodationId,
    claim,
    currentPath,
    location.key,
    pending,
    session.state.status,
  ]);

  const claimed = useMemo<AccommodationDetailClaimedAuthIntent | null>(() => {
    const activeClaim =
      claimedIntent &&
      accommodationId !== null &&
      claimedIntent.intent.accommodationId === accommodationId &&
      claimedIntent.source.locationKey === location.key &&
      claimedIntent.source.path === currentPath &&
      isCurrentSession(claimedIntent.session)
        ? claimedIntent
        : null;

    return activeClaim
      ? {
          attemptId: activeClaim.attemptId,
          intent: activeClaim.intent,
          isCurrent: () =>
            routeLease.isCurrent() && isCurrentSession(activeClaim.session),
        }
      : null;
  }, [
    accommodationId,
    claimedIntent,
    currentPath,
    location.key,
    routeLease,
    isCurrentSession,
  ]);

  const authIntent = useMemo(
    () => ({
      claimed,
      cancelPending: cancelPendingAuthIntent,
      completeClaim: (attemptId: number) => {
        setClaimedIntent((current) =>
          current?.attemptId === attemptId ? null : current,
        );
      },
      request: requestAuthIntent,
    }),
    [cancelPendingAuthIntent, claimed, requestAuthIntent],
  );

  const replaceHistoryState = useCallback(
    (handle: BookingTransactionHandle | null): boolean => {
      const state = handle
        ? bookingPaymentStateCodec.serializeFlowReference(
            handle.flowId,
            handle.locator,
          )
        : null;
      if (handle && !state) return false;
      return browserWindowNavigation.replaceCurrentUserState(state);
    },
    [],
  );

  const openPayment = useCallback(
    (
      handle: BookingTransactionHandle,
      snapshot: BookingTransactionSnapshot,
    ) => {
      if (
        accommodationId === null ||
        snapshot.accommodationId !== accommodationId ||
        snapshot.reservationUid === null ||
        handle.locator.kind !== "reservation" ||
        handle.locator.reservationUid !== snapshot.reservationUid
      ) {
        return;
      }
      const state = bookingPaymentStateCodec.serializeFlowReference(
        handle.flowId,
        handle.locator,
      );
      if (!state) return;
      navigate(routeTo.accommodationConfirm(accommodationId), { state });
    },
    [accommodationId, navigate],
  );

  const completeTerminalReservation = useCallback(
    async (
      handle: BookingTransactionHandle,
      snapshot: BookingTransactionSnapshot,
      commandRouteLease: { isCurrent(): boolean },
    ): Promise<boolean> => {
      const captured = captureAuthenticatedSession();
      if (
        (snapshot.phase !== "complimentary-observed" &&
          snapshot.phase !== "reservation-status-observed" &&
          snapshot.phase !== "hold-released") ||
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
        await reservationPublication.guestReservationChanged({
          reservationUid: snapshot.reservationUid,
          scope: captured,
        });
      } catch {
        return false;
      }
      if (!commandRouteLease.isCurrent() || !isCurrentSession(captured)) {
        return false;
      }
      const acknowledged = bookingWorkflow.acknowledgeTerminal({
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
      bookingWorkflow,
      captureAuthenticatedSession,
      isCurrentSession,
      navigate,
      reservationPublication,
    ],
  );

  const replaceBookingDates = useCallback(
    (checkIn: string | null, checkOut: string | null) => {
      const params = accommodationBookingCodec.pick(location.search);
      if (checkIn) params.set("checkIn", checkIn);
      else params.delete("checkIn");
      if (checkOut) params.set("checkOut", checkOut);
      else params.delete("checkOut");
      const search = params.toString();

      navigate(
        {
          pathname: location.pathname,
          search: search ? `?${search}` : "",
          hash: location.hash,
        },
        {
          replace: true,
          state: browserWindowNavigation.getCurrentUserState(),
        },
      );
    },
    [location.hash, location.pathname, location.search, navigate],
  );
  const recordRecentlyViewed = useCallback(
    (
      recordAccommodationId: number,
      options: { readonly signal: AbortSignal },
    ) => recentlyViewedApi.add(recordAccommodationId, options),
    [],
  );

  const authenticatedScope = captureAuthenticatedSession();
  const wishlistMembership =
    authenticatedScope && isCurrentSession(authenticatedScope)
      ? { commands: wishlistCommands, scope: authenticatedScope }
      : undefined;

  return (
    <AccommodationDetailController
      key={accommodationId ?? "invalid"}
      accommodationId={accommodationId}
      amenityCatalog={accommodationAmenityCatalog}
      authIntent={authIntent}
      bookingFlowHandle={flowHandle}
      bookingRouteState={bookingRouteState}
      bookingWorkflow={bookingWorkflow}
      isAuthenticated={isAuthenticated}
      isPaymentRecoveryBlocked={
        paymentRecoveryFenceStatus !== "none" && flowHandle === null
      }
      onBookingFlowHandleChange={replaceHistoryState}
      onOpenPayment={openPayment}
      onOpenTrips={() => navigate(routeTo.profile(), { replace: true })}
      onReplaceBookingDates={replaceBookingDates}
      onTerminalReservation={completeTerminalReservation}
      recordRecentlyViewed={recordRecentlyViewed}
      resolveImageUrl={resolveImageUrl}
      routeLease={routeLease}
      scope={scope}
      session={workflowSession}
      {...(wishlistMembership === undefined ? {} : { wishlistMembership })}
    />
  );
}

function AccommodationDetailRoute() {
  return (
    <WishlistMembershipRouteBoundary>
      <AccommodationDetailRouteContent />
    </WishlistMembershipRouteBoundary>
  );
}

export default AccommodationDetailRoute;
