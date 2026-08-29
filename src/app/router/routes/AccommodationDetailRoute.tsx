import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPath,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { parsePositiveInteger } from "../codecs/queryCodecUtils";
import { useSession } from "../../session/useSession";
import {
  toAuthIntentLocalDate,
  useAuthIntent,
  type AuthIntent,
  type AuthIntentAttemptId,
  type ClaimedAuthIntent,
} from "../../../workflows/auth-intent";
import {
  AccommodationDetailRoute as LegacyAccommodationDetailRoute,
  type AccommodationDetailAuthIntent,
  type AccommodationDetailAuthIntentController,
  type AccommodationDetailAuthIntentGeneration,
} from "../../../features/accommodations/AccommodationDetailRoute";
import { useWishlistMembership } from "../../../workflows/wishlist-membership";
import { WishlistMembershipRouteBoundary } from "./WishlistMembershipRouteBoundary";

const toRuntimeAuthIntent = (
  intent: AccommodationDetailAuthIntent,
): AuthIntent => {
  switch (intent.type) {
    case "wishlist.open":
    case "coupon.issue":
      return intent;
    case "reservation.start":
      return {
        type: intent.type,
        accommodationId: intent.accommodationId,
        checkIn: toAuthIntentLocalDate(intent.checkIn),
        checkOut: toAuthIntentLocalDate(intent.checkOut),
        adultCount: intent.adultCount,
        childCount: intent.childCount,
        infantCount: intent.infantCount,
        petCount: intent.petCount,
        couponId: intent.couponId,
      };
  }
};

function AccommodationDetailRouteContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [bookingSearchParams, setBookingSearchParams] = useSearchParams();
  const { pending, request, cancel, claim } = useAuthIntent();
  const session = useSession();
  const { state: sessionState, isCurrentSession } = session;
  const wishlistCommands = useWishlistMembership();
  const requestedAttemptIdRef = useRef<AuthIntentAttemptId | null>(null);
  const [claimedIntent, setClaimedIntent] =
    useState<ClaimedAuthIntent | null>(null);
  const parsedAccommodationId = parsePositiveInteger(id ?? null, 0);
  const accommodationId = parsedAccommodationId > 0
    ? parsedAccommodationId
    : null;
  const currentPath = createPath(location);

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
    if (attemptId !== null) {
      cancel(attemptId);
    }
  }, [cancel]);

  useEffect(() => {
    if (
      sessionState.status !== "authenticated" ||
      !accommodationId ||
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
    if (!claimed) {
      return;
    }

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
    sessionState.status,
  ]);

  const activeClaim =
    claimedIntent &&
    accommodationId !== null &&
    claimedIntent.intent.accommodationId === accommodationId &&
    claimedIntent.source.locationKey === location.key &&
    claimedIntent.source.path === currentPath &&
    isCurrentSession(claimedIntent.session)
      ? claimedIntent
      : null;

  const generation = useMemo<AccommodationDetailAuthIntentGeneration | null>(
    () =>
      activeClaim
        ? {
            generation: activeClaim.attemptId,
            intent: activeClaim.intent,
            isCurrent: () => isCurrentSession(activeClaim.session),
          }
        : null,
    [activeClaim, isCurrentSession],
  );
  const authIntent = useMemo<AccommodationDetailAuthIntentController>(
    () => ({
      generation,
      request: requestAuthIntent,
      cancelPending: cancelPendingAuthIntent,
    }),
    [cancelPendingAuthIntent, generation, requestAuthIntent],
  );
  const featureGenerationKey = `${id ?? "missing"}:${
    activeClaim?.attemptId ?? "base"
  }`;
  const wishlistScope =
    sessionState.status === "authenticated"
      ? session.captureAuthenticatedSession()
      : null;
  const wishlistMembership =
    wishlistScope !== null && isCurrentSession(wishlistScope)
      ? { commands: wishlistCommands, scope: wishlistScope }
      : undefined;

  return (
    <LegacyAccommodationDetailRoute
      key={featureGenerationKey}
      authIntent={authIntent}
      accommodationId={id}
      bookingSearchParams={bookingSearchParams}
      navigate={navigate}
      setBookingSearchParams={setBookingSearchParams}
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
