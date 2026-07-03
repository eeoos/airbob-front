import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  buildWishlistRouteSearchParams,
  parseWishlistRouteState,
} from "../lib/wishlistRouteState";

export const useWishlistRouteViewState = () => {
  const [searchParams, setSearchParams] = useSearchParams();
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
  }, []);

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
