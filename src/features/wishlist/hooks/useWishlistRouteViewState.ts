import { useCallback, useEffect, useState } from "react";
import {
  buildWishlistRouteSearchParams,
  parseWishlistRouteState,
} from "../lib/wishlistRouteState";

type SetWishlistRouteSearchParams = (
  nextParams: URLSearchParams,
  options?: { replace?: boolean },
) => void;

export const useWishlistRouteViewState = (
  searchParams: URLSearchParams,
  setSearchParams: SetWishlistRouteSearchParams,
) => {
  const wishlistRouteState = parseWishlistRouteState(searchParams);
  const [selectedWishlist, setSelectedWishlist] = useState<number | null>(
    wishlistRouteState.wishlistId
  );
  const [showRecentlyViewed, setShowRecentlyViewed] = useState(
    wishlistRouteState.view === "recently-viewed"
  );
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    const routeState = parseWishlistRouteState(searchParams);

    setSelectedWishlist(routeState.wishlistId);
    setShowRecentlyViewed(routeState.view === "recently-viewed");
    setIsEditMode(false);
  }, [searchParams]);

  const openRecentlyViewed = useCallback(() => {
    setShowRecentlyViewed(true);
    setSelectedWishlist(null);
    setIsEditMode(false);
    setSearchParams(
      buildWishlistRouteSearchParams({
        view: "recently-viewed",
        wishlistId: null,
      })
    );
  }, [setSearchParams]);

  const backToIndex = useCallback(() => {
    setShowRecentlyViewed(false);
    setSelectedWishlist(null);
    setIsEditMode(false);
    setSearchParams(
      buildWishlistRouteSearchParams({
        view: "index",
        wishlistId: null,
      })
    );
  }, [setSearchParams]);

  const openWishlist = useCallback(
    (wishlistId: number) => {
      setSelectedWishlist(wishlistId);
      setShowRecentlyViewed(false);
      setIsEditMode(false);
      setSearchParams(
        buildWishlistRouteSearchParams({
          view: "wishlist-detail",
          wishlistId,
        })
      );
    },
    [setSearchParams]
  );

  const clearSelectedWishlist = useCallback(() => {
    setSelectedWishlist(null);
    setShowRecentlyViewed(false);
    setIsEditMode(false);
    setSearchParams(
      buildWishlistRouteSearchParams({ view: "index", wishlistId: null }),
      { replace: true }
    );
  }, [setSearchParams]);

  return {
    backToIndex,
    clearSelectedWishlist,
    isEditMode,
    openRecentlyViewed,
    openWishlist,
    selectedWishlist,
    setIsEditMode,
    showRecentlyViewed,
  };
};
