import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPath,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  saveReservationCheckoutState,
  type ReservationCheckoutState,
} from "../../../features/reservations/public";
import { recentlyViewedApi } from "../../../features/wishlist/public";
import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import {
  AccommodationDetailController,
  type AccommodationDetailAuthIntent,
  type AccommodationDetailClaimedAuthIntent,
} from "../../../screens/accommodation-detail/public";
import {
  toAuthIntentLocalDate,
  useAuthIntent,
  type AuthIntent,
  type AuthIntentAttemptId,
  type ClaimedAuthIntent,
} from "../../../workflows/auth-intent";
import type { ReservationCheckoutHandoffPort } from "../../../workflows/booking-payment/reservation-create";
import { useWishlistMembership } from "../../../workflows/wishlist-membership";
import { useSession } from "../../session/useSession";
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
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const { pending, request, cancel, claim } = useAuthIntent();
  const wishlistCommands = useWishlistMembership();
  const requestedAttemptIdRef = useRef<AuthIntentAttemptId | null>(null);
  const [claimedIntent, setClaimedIntent] =
    useState<ClaimedAuthIntent | null>(null);
  const parsedAccommodationId = parsePositiveInteger(id ?? null, 0);
  const accommodationId = parsedAccommodationId > 0
    ? parsedAccommodationId
    : null;
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
    () => ({
      epoch: sessionEpoch,
      subject: sessionSubject,
    }),
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
            routeLease.isCurrent() &&
            isCurrentSession(activeClaim.session),
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

  const checkoutHandoff = useMemo<ReservationCheckoutHandoffPort>(
    () => ({
      commit(input) {
        if (
          accommodationId === null ||
          input.intent.accommodationId !== accommodationId ||
          !routeLease.isCurrent() ||
          !isCurrentSession(input.session)
        ) {
          return;
        }

        const state: ReservationCheckoutState = {
          reservationUid: input.reservation.reservationUid,
          orderName: input.reservation.orderName,
          amount: input.reservation.amount,
          customerEmail: input.reservation.customerEmail,
          customerName: input.reservation.customerName,
          checkIn: input.intent.checkIn,
          checkOut: input.intent.checkOut,
          adultOccupancy: input.intent.adultCount,
          childOccupancy: input.intent.childCount,
          infantOccupancy: input.intent.infantCount,
          petOccupancy: input.intent.petCount,
          couponName: input.appliedCoupon?.name ?? null,
          couponDiscount: input.appliedCoupon?.discount ?? null,
        };

        saveReservationCheckoutState(String(accommodationId), state);
        navigate(routeTo.accommodationConfirm(accommodationId), { state });
      },
    }),
    [accommodationId, isCurrentSession, navigate, routeLease],
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
        { replace: true },
      );
    },
    [location.hash, location.pathname, location.search, navigate],
  );
  const recordRecentlyViewed = useCallback(
    (recordAccommodationId: number, options: { readonly signal: AbortSignal }) =>
      recentlyViewedApi.add(recordAccommodationId, options),
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
      authIntent={authIntent}
      bookingRouteState={bookingRouteState}
      checkoutHandoff={checkoutHandoff}
      isAuthenticated={isAuthenticated}
      onReplaceBookingDates={replaceBookingDates}
      recordRecentlyViewed={recordRecentlyViewed}
      resolveImageUrl={resolveImageUrl}
      routeLease={routeLease}
      scope={scope}
      session={workflowSession}
      wishlistMembership={wishlistMembership}
    />
  );
}

export function AccommodationDetailRoute() {
  return (
    <WishlistMembershipRouteBoundary>
      <AccommodationDetailRouteContent />
    </WishlistMembershipRouteBoundary>
  );
}

export default AccommodationDetailRoute;
