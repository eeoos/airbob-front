import { useCallback, useEffect, useMemo, useState } from "react";
import { recentlyViewedApi, wishlistApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { RecentlyViewedAccommodationInfo } from "../../../types/recentlyViewed";
import {
  WishlistAccommodationInfo,
  WishlistInfo,
} from "../../../types/wishlist";

const WISHLIST_PAGE_SIZE = 20;

type UseWishlistDataOptions = {
  enabled: boolean;
  selectedWishlistId: number | null;
  showRecentlyViewed: boolean;
};

export function useWishlistData({
  enabled,
  selectedWishlistId,
  showRecentlyViewed,
}: UseWishlistDataOptions) {
  const { error, handleError, clearError } = useApiError();
  const [recentlyViewed, setRecentlyViewed] = useState<
    RecentlyViewedAccommodationInfo[]
  >([]);
  const [wishlists, setWishlists] = useState<WishlistInfo[]>([]);
  const [wishlistAccommodations, setWishlistAccommodations] = useState<
    WishlistAccommodationInfo[]
  >([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRecentlyViewedLoading, setIsRecentlyViewedLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [wishlistsCursor, setWishlistsCursor] = useState<string | null>(null);
  const [wishlistsHasNext, setWishlistsHasNext] = useState(false);
  const [isLoadingMoreWishlists, setIsLoadingMoreWishlists] = useState(false);

  const resetWishlistAccommodations = useCallback(() => {
    setWishlistAccommodations([]);
    setCursor(null);
    setHasNext(false);
    setIsDetailLoading(false);
    setIsLoadingMore(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsInitialLoading(false);
      return;
    }

    let isCancelled = false;

    const fetchInitialData = async () => {
      setIsInitialLoading(true);
      clearError();

      try {
        const [recentlyViewedResponse, wishlistsResponse] = await Promise.all([
          recentlyViewedApi.getRecentlyViewed(),
          wishlistApi.getWishlists({ size: WISHLIST_PAGE_SIZE }),
        ]);

        if (isCancelled) return;

        setRecentlyViewed(recentlyViewedResponse?.accommodations || []);
        setWishlists(wishlistsResponse?.wishlists || []);
        setWishlistsCursor(wishlistsResponse?.page_info?.next_cursor || null);
        setWishlistsHasNext(wishlistsResponse?.page_info?.has_next || false);
      } catch (err) {
        if (!isCancelled) {
          handleError(err);
        }
      } finally {
        if (!isCancelled) {
          setIsInitialLoading(false);
        }
      }
    };

    fetchInitialData();

    return () => {
      isCancelled = true;
    };
  }, [clearError, enabled, handleError]);

  useEffect(() => {
    if (!enabled || !selectedWishlistId || showRecentlyViewed) {
      resetWishlistAccommodations();
      return;
    }

    let isCancelled = false;

    const fetchWishlistAccommodations = async () => {
      setIsDetailLoading(true);
      clearError();

      try {
        const response = await wishlistApi.getWishlistAccommodations(
          selectedWishlistId,
          { size: WISHLIST_PAGE_SIZE }
        );

        if (isCancelled) return;

        setWishlistAccommodations(response?.wishlist_accommodations || []);
        setCursor(response?.page_info?.next_cursor || null);
        setHasNext(response?.page_info?.has_next || false);
      } catch (err) {
        if (!isCancelled) {
          handleError(err);
        }
      } finally {
        if (!isCancelled) {
          setIsDetailLoading(false);
        }
      }
    };

    fetchWishlistAccommodations();

    return () => {
      isCancelled = true;
    };
  }, [
    clearError,
    enabled,
    handleError,
    resetWishlistAccommodations,
    selectedWishlistId,
    showRecentlyViewed,
  ]);

  const reloadRecentlyViewed = useCallback(async () => {
    setIsRecentlyViewedLoading(true);
    clearError();

    try {
      const response = await recentlyViewedApi.getRecentlyViewed();
      setRecentlyViewed(response?.accommodations || []);
    } catch (err) {
      handleError(err);
    } finally {
      setIsRecentlyViewedLoading(false);
    }
  }, [clearError, handleError]);

  const loadMoreWishlistAccommodations = useCallback(async () => {
    if (
      !selectedWishlistId ||
      showRecentlyViewed ||
      !hasNext ||
      isLoadingMore ||
      !cursor
    ) {
      return;
    }

    setIsLoadingMore(true);
    clearError();

    try {
      const response = await wishlistApi.getWishlistAccommodations(
        selectedWishlistId,
        {
          cursor,
          size: WISHLIST_PAGE_SIZE,
        }
      );

      setWishlistAccommodations((prev) => [
        ...prev,
        ...(response?.wishlist_accommodations || []),
      ]);
      setCursor(response?.page_info?.next_cursor || null);
      setHasNext(response?.page_info?.has_next || false);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    clearError,
    cursor,
    handleError,
    hasNext,
    isLoadingMore,
    selectedWishlistId,
    showRecentlyViewed,
  ]);

  const loadMoreWishlists = useCallback(async () => {
    if (!wishlistsHasNext || isLoadingMoreWishlists || !wishlistsCursor) {
      return;
    }

    setIsLoadingMoreWishlists(true);
    clearError();

    try {
      const response = await wishlistApi.getWishlists({
        cursor: wishlistsCursor,
        size: WISHLIST_PAGE_SIZE,
      });

      setWishlists((prev) => [...prev, ...(response?.wishlists || [])]);
      setWishlistsCursor(response?.page_info?.next_cursor || null);
      setWishlistsHasNext(response?.page_info?.has_next || false);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingMoreWishlists(false);
    }
  }, [
    clearError,
    handleError,
    isLoadingMoreWishlists,
    wishlistsCursor,
    wishlistsHasNext,
  ]);

  const removeRecentlyViewed = useCallback(
    async (accommodationId: number) => {
      try {
        await recentlyViewedApi.remove(accommodationId);
        setRecentlyViewed((prev) =>
          prev.filter((item) => item.accommodation_id !== accommodationId)
        );
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  const deleteWishlist = useCallback(
    async (wishlistId: number) => {
      try {
        await wishlistApi.delete(wishlistId);
        setWishlists((prev) => prev.filter((wishlist) => wishlist.id !== wishlistId));
        return true;
      } catch (err) {
        handleError(err);
        return false;
      }
    },
    [handleError]
  );

  const removeFromWishlist = useCallback(
    async (wishlistAccommodationId: number) => {
      try {
        await wishlistApi.removeAccommodation(wishlistAccommodationId);
        setWishlistAccommodations((prev) =>
          prev.filter(
            (item) => item.wishlist_accommodation_id !== wishlistAccommodationId
          )
        );
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  const saveWishlistAccommodationMemo = useCallback(
    async (wishlistAccommodationId: number, memo: string) => {
      const trimmedMemo = memo.trim();
      if (!trimmedMemo) return false;

      try {
        await wishlistApi.updateAccommodationMemo(wishlistAccommodationId, {
          memo: trimmedMemo,
        });

        setWishlistAccommodations((prev) =>
          prev.map((item) =>
            item.wishlist_accommodation_id === wishlistAccommodationId
              ? { ...item, memo: trimmedMemo }
              : item
          )
        );
        return true;
      } catch (err) {
        handleError(err);
        return false;
      }
    },
    [handleError]
  );

  const toggleRecentlyViewedWishlistState = useCallback(
    (accommodationId: number) => {
      setRecentlyViewed((prev) =>
        prev.map((item) =>
          item.accommodation_id === accommodationId
            ? { ...item, is_in_wishlist: !item.is_in_wishlist }
            : item
        )
      );
    },
    []
  );

  const refreshRecentlyViewedWishlistState = useCallback(
    async (accommodationId: number) => {
      const response = await wishlistApi.getWishlists({
        accommodationId,
        size: WISHLIST_PAGE_SIZE,
      });
      const isInAnyWishlist =
        response?.wishlists?.some((wishlist) => wishlist.is_contained) || false;

      setRecentlyViewed((prev) =>
        prev.map((item) =>
          item.accommodation_id === accommodationId
            ? { ...item, is_in_wishlist: isInAnyWishlist }
            : item
        )
      );
    },
    []
  );

  const isLoading = useMemo(
    () => isInitialLoading || isRecentlyViewedLoading || isDetailLoading,
    [isDetailLoading, isInitialLoading, isRecentlyViewedLoading]
  );

  return {
    clearError,
    deleteWishlist,
    error,
    hasNext,
    isLoading,
    isLoadingMore,
    isLoadingMoreWishlists,
    loadMoreWishlistAccommodations,
    loadMoreWishlists,
    refreshRecentlyViewedWishlistState,
    recentlyViewed,
    reloadRecentlyViewed,
    removeFromWishlist,
    removeRecentlyViewed,
    saveWishlistAccommodationMemo,
    toggleRecentlyViewedWishlistState,
    wishlistAccommodations,
    wishlists,
    wishlistsHasNext,
  };
}
