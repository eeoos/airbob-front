import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSession } from "../../session/useSession";
import {
  SearchRoute as LegacySearchRoute,
  type SearchWishlistAuthIntentBridge,
} from "../../../features/search/SearchRoute";
import {
  isWishlistOpenAuthIntent,
  useAuthIntent,
  type AuthIntentAttemptId,
  type ClaimedAuthIntent,
  type WishlistOpenAuthIntent,
} from "../../../workflows/auth-intent";

export function SearchRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isCurrentSession, state } = useSession();
  const { cancel, claim, request } = useAuthIntent();
  const [claimedIntent, setClaimedIntent] = useState<
    ClaimedAuthIntent<WishlistOpenAuthIntent> | null
  >(null);

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
  const wishlistAuthIntent = useMemo<SearchWishlistAuthIntentBridge>(
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

  return (
    <LegacySearchRoute
      searchParams={searchParams}
      setSearchParams={setSearchParams}
      wishlistAuthIntent={wishlistAuthIntent}
    />
  );
}

export default SearchRoute;
