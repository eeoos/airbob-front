import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import {
  SearchController,
  type SearchNavigationCommands,
  type SearchWishlistAuthIntent,
} from "../../../screens/search/public";
import {
  isWishlistOpenAuthIntent,
  useAuthIntent,
  type AuthIntentAttemptId,
  type ClaimedAuthIntent,
  type WishlistOpenAuthIntent,
} from "../../../workflows/auth-intent";
import { useWishlistMembership } from "../../../workflows/wishlist-membership";
import { useSession } from "../../session/useSession";
import { searchCodec } from "../codecs/searchCodec";
import { routeTo } from "../paths";
import { WishlistMembershipRouteBoundary } from "./WishlistMembershipRouteBoundary";

const BOOKING_QUERY_KEYS = [
  "checkIn",
  "checkOut",
  "adultOccupancy",
  "childOccupancy",
  "infantOccupancy",
  "petOccupancy",
] as const;

const toBookingSafeSearchParams = (params: URLSearchParams) => {
  const safeParams = new URLSearchParams();

  BOOKING_QUERY_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value !== null && value !== "") safeParams.set(key, value);
  });

  return safeParams;
};

function SearchRouteContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useSession();
  const { isCurrentSession, state } = session;
  const { cancel, claim, request } = useAuthIntent();
  const wishlistCommands = useWishlistMembership();
  const [claimedIntent, setClaimedIntent] = useState<
    ClaimedAuthIntent<WishlistOpenAuthIntent> | null
  >(null);
  const searchParamsString = searchParams.toString();
  const routeState = useMemo(
    () => searchCodec.parse(new URLSearchParams(searchParamsString)),
    [searchParamsString],
  );
  const detailSearchParams = useMemo(
    () =>
      toBookingSafeSearchParams(new URLSearchParams(searchParamsString)),
    [searchParamsString],
  );
  const detailSearchString = detailSearchParams.toString();
  const queryScope = useMemo(
    () => ({
      epoch: state.epoch,
      subject: state.status === "authenticated" ? state.subject : null,
    }),
    [state],
  );

  useEffect(() => {
    if (state.status !== "authenticated" || claimedIntent) return;

    const nextIntent = claim(isWishlistOpenAuthIntent);
    if (nextIntent) setClaimedIntent(nextIntent);
  }, [claim, claimedIntent, state.status]);

  const requestWishlistIntent = useCallback(
    (accommodationId: number) =>
      request({ type: "wishlist.open", accommodationId }) as number,
    [request],
  );
  const cancelWishlistIntent = useCallback(
    (attemptId: number) => {
      cancel(attemptId as AuthIntentAttemptId);
    },
    [cancel],
  );
  const completeResume = useCallback((attemptId: number) => {
    setClaimedIntent((current) =>
      current?.attemptId === attemptId ? null : current,
    );
  }, []);
  const wishlistAuthIntent = useMemo<SearchWishlistAuthIntent>(
    () => ({
      request: requestWishlistIntent,
      cancel: cancelWishlistIntent,
      resumed: claimedIntent
        ? {
            attemptId: claimedIntent.attemptId as number,
            accommodationId: claimedIntent.intent.accommodationId,
            isCurrent: () => isCurrentSession(claimedIntent.session),
          }
        : null,
      completeResume,
    }),
    [
      cancelWishlistIntent,
      claimedIntent,
      completeResume,
      isCurrentSession,
      requestWishlistIntent,
    ],
  );
  const navigation = useMemo<SearchNavigationCommands>(
    () => {
      const getAccommodationHref = (accommodationId: number) => {
        const basePath = routeTo.accommodationDetail(accommodationId);
        return detailSearchString
          ? `${basePath}?${detailSearchString}`
          : basePath;
      };

      return {
        getAccommodationHref,
        openAccommodation(accommodationId) {
          browserWindowNavigation.openInNewTab(
            getAccommodationHref(accommodationId),
          );
        },
        openPage(page) {
          const nextParams = new URLSearchParams(searchParamsString);
          if (page === 0) nextParams.delete("page");
          else nextParams.set("page", String(page));
          setSearchParams(nextParams, { replace: false });
        },
        replaceMapBounds(bounds) {
          const nextParams = searchCodec.pick(
            new URLSearchParams(searchParamsString),
          );
          nextParams.delete("destination");
          nextParams.delete("page");
          nextParams.delete("lat");
          nextParams.delete("lng");
          nextParams.set("topLeftLat", String(bounds.north));
          nextParams.set("topLeftLng", String(bounds.west));
          nextParams.set("bottomRightLat", String(bounds.south));
          nextParams.set("bottomRightLng", String(bounds.east));
          setSearchParams(nextParams, { replace: true });
        },
        scrollResultsToTop() {
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      };
    },
    [detailSearchString, searchParamsString, setSearchParams],
  );
  const wishlistScope =
    state.status === "authenticated"
      ? session.captureAuthenticatedSession()
      : null;
  const wishlistMembership =
    wishlistScope !== null && isCurrentSession(wishlistScope)
      ? { commands: wishlistCommands, scope: wishlistScope }
      : undefined;

  return (
    <SearchController
      isAuthenticated={state.status === "authenticated"}
      navigation={navigation}
      routeState={routeState}
      scope={queryScope}
      wishlistAuthIntent={wishlistAuthIntent}
      {...(wishlistMembership === undefined ? {} : { wishlistMembership })}
    />
  );
}

export function SearchRoute() {
  return (
    <WishlistMembershipRouteBoundary>
      <SearchRouteContent />
    </WishlistMembershipRouteBoundary>
  );
}

export default SearchRoute;
