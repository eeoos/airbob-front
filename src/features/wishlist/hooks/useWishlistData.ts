import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { recentlyViewedApi } from "../../../api";
import { wishlistApi } from "../../../api/wishlist";
import { useApiError } from "../../../hooks/useApiError";
import { useHandledQueryError } from "../../../query/useHandledQueryError";
import {
  invalidateWishlistCollectionCaches,
  removeRecentlyViewedAccommodationFromCache,
  removeWishlistAccommodationFromCache,
  removeWishlistFromCache,
  setAccommodationScopedWishlistMembershipCache,
  updateRecentlyViewedWishlistStateInCache,
  updateWishlistAccommodationMemoInCache,
} from "../lib/wishlistCacheSync";
import { fetchAccommodationWishlistMembership } from "../lib/wishlistMembership";
import { useRecentlyViewedQuery } from "./useRecentlyViewedQuery";
import { useWishlistDetailQuery } from "./useWishlistDetailQuery";
import { useWishlistListsQuery } from "./useWishlistListsQuery";

type UseWishlistDataOptions = {
  selectedWishlistId: number | null;
  showRecentlyViewed: boolean;
};

export function useWishlistData({
  selectedWishlistId,
  showRecentlyViewed,
}: UseWishlistDataOptions) {
  const queryClient = useQueryClient();
  const { error, handleError, clearError } = useApiError();
  const [pendingMutationKeys, setPendingMutationKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const pendingMutationKeysRef = useRef(new Set<string>());
  const recentlyViewedQuery = useRecentlyViewedQuery();
  const wishlistsQuery = useWishlistListsQuery();
  const wishlistDetailQuery = useWishlistDetailQuery({
    wishlistId: selectedWishlistId,
    enabled: Boolean(selectedWishlistId) && !showRecentlyViewed,
  });

  useEffect(() => {
    clearError();
  }, [clearError]);

  useHandledQueryError({
    error: recentlyViewedQuery.error,
    errorUpdatedAt: recentlyViewedQuery.errorUpdatedAt,
    isError: recentlyViewedQuery.isError,
    onError: handleError,
  });

  useHandledQueryError({
    error: wishlistsQuery.error,
    errorUpdatedAt: wishlistsQuery.errorUpdatedAt,
    isError: wishlistsQuery.isError,
    onError: handleError,
  });

  useHandledQueryError({
    error: wishlistDetailQuery.error,
    errorUpdatedAt: wishlistDetailQuery.errorUpdatedAt,
    isError: wishlistDetailQuery.isError,
    onError: handleError,
  });

  const recentlyViewed = recentlyViewedQuery.data?.accommodations ?? [];
  const wishlists = useMemo(
    () =>
      wishlistsQuery.data?.pages.flatMap((page) => page?.wishlists ?? []) ?? [],
    [wishlistsQuery.data]
  );
  const wishlistAccommodations = useMemo(
    () =>
      wishlistDetailQuery.data?.pages.flatMap(
        (page) => page?.wishlist_accommodations ?? []
      ) ?? [],
    [wishlistDetailQuery.data]
  );

  const removeRecentlyViewedMutation = useMutation({
    mutationFn: (accommodationId: number) =>
      recentlyViewedApi.remove(accommodationId),
    onSuccess: (_data, accommodationId) => {
      removeRecentlyViewedAccommodationFromCache(queryClient, accommodationId);
    },
  });

  const deleteWishlistMutation = useMutation({
    mutationFn: (wishlistId: number) => wishlistApi.delete(wishlistId),
    onSuccess: (_data, wishlistId) => {
      removeWishlistFromCache(queryClient, wishlistId);
      invalidateWishlistCollectionCaches(queryClient);
    },
  });

  const removeFromWishlistMutation = useMutation({
    mutationFn: (wishlistAccommodationId: number) =>
      wishlistApi.removeAccommodation(wishlistAccommodationId),
    onSuccess: (_data, wishlistAccommodationId) => {
      removeWishlistAccommodationFromCache(
        queryClient,
        wishlistAccommodationId
      );
      invalidateWishlistCollectionCaches(queryClient);
    },
  });

  const saveWishlistAccommodationMemoMutation = useMutation({
    mutationFn: ({
      memo,
      wishlistAccommodationId,
    }: {
      memo: string;
      wishlistAccommodationId: number;
    }) =>
      wishlistApi.updateAccommodationMemo(wishlistAccommodationId, {
        memo,
      }),
    onSuccess: (_data, { memo, wishlistAccommodationId }) => {
      updateWishlistAccommodationMemoInCache(
        queryClient,
        wishlistAccommodationId,
        memo,
      );
    },
  });

  const reloadRecentlyViewed = useCallback(async () => {
    clearError();
    await recentlyViewedQuery.refetch();
  }, [clearError, recentlyViewedQuery]);

  const loadMoreWishlistAccommodations = useCallback(async () => {
    if (
      !selectedWishlistId ||
      showRecentlyViewed ||
      !wishlistDetailQuery.hasNextPage ||
      wishlistDetailQuery.isFetching
    ) {
      return;
    }

    clearError();
    await wishlistDetailQuery.fetchNextPage();
  }, [
    clearError,
    selectedWishlistId,
    showRecentlyViewed,
    wishlistDetailQuery,
  ]);

  const loadMoreWishlists = useCallback(async () => {
    if (!wishlistsQuery.hasNextPage || wishlistsQuery.isFetching) {
      return;
    }

    clearError();
    await wishlistsQuery.fetchNextPage();
  }, [clearError, wishlistsQuery]);

  const removeRecentlyViewed = useCallback(
    async (accommodationId: number) => {
      const mutationKey = `recently-viewed:${accommodationId}`;
      if (pendingMutationKeysRef.current.has(mutationKey)) {
        return;
      }

      const nextPendingKeys = new Set(pendingMutationKeysRef.current).add(
        mutationKey,
      );
      pendingMutationKeysRef.current = nextPendingKeys;
      setPendingMutationKeys(nextPendingKeys);
      clearError();

      try {
        await removeRecentlyViewedMutation.mutateAsync(accommodationId);
      } catch (err) {
        handleError(err);
      } finally {
        const remainingPendingKeys = new Set(pendingMutationKeysRef.current);
        remainingPendingKeys.delete(mutationKey);
        pendingMutationKeysRef.current = remainingPendingKeys;
        setPendingMutationKeys(remainingPendingKeys);
      }
    },
    [clearError, handleError, removeRecentlyViewedMutation]
  );

  const deleteWishlist = useCallback(
    async (wishlistId: number) => {
      const mutationKey = `wishlist:${wishlistId}`;
      if (pendingMutationKeysRef.current.has(mutationKey)) {
        return false;
      }

      const nextPendingKeys = new Set(pendingMutationKeysRef.current).add(
        mutationKey,
      );
      pendingMutationKeysRef.current = nextPendingKeys;
      setPendingMutationKeys(nextPendingKeys);
      clearError();

      try {
        await deleteWishlistMutation.mutateAsync(wishlistId);
        return true;
      } catch (err) {
        handleError(err);
        return false;
      } finally {
        const remainingPendingKeys = new Set(pendingMutationKeysRef.current);
        remainingPendingKeys.delete(mutationKey);
        pendingMutationKeysRef.current = remainingPendingKeys;
        setPendingMutationKeys(remainingPendingKeys);
      }
    },
    [clearError, deleteWishlistMutation, handleError]
  );

  const removeFromWishlist = useCallback(
    async (wishlistAccommodationId: number) => {
      const mutationKey = `wishlist-accommodation:${wishlistAccommodationId}`;
      if (pendingMutationKeysRef.current.has(mutationKey)) {
        return;
      }

      const nextPendingKeys = new Set(pendingMutationKeysRef.current).add(
        mutationKey,
      );
      pendingMutationKeysRef.current = nextPendingKeys;
      setPendingMutationKeys(nextPendingKeys);
      clearError();

      try {
        await removeFromWishlistMutation.mutateAsync(wishlistAccommodationId);
      } catch (err) {
        handleError(err);
      } finally {
        const remainingPendingKeys = new Set(pendingMutationKeysRef.current);
        remainingPendingKeys.delete(mutationKey);
        pendingMutationKeysRef.current = remainingPendingKeys;
        setPendingMutationKeys(remainingPendingKeys);
      }
    },
    [clearError, handleError, removeFromWishlistMutation]
  );

  const saveWishlistAccommodationMemo = useCallback(
    async (wishlistAccommodationId: number, memo: string) => {
      const trimmedMemo = memo.trim();
      if (!trimmedMemo) return false;

      clearError();

      try {
        await saveWishlistAccommodationMemoMutation.mutateAsync({
          wishlistAccommodationId,
          memo: trimmedMemo,
        });
        return true;
      } catch (err) {
        handleError(err);
        return false;
      }
    },
    [clearError, handleError, saveWishlistAccommodationMemoMutation]
  );

  const toggleRecentlyViewedWishlistState = useCallback(
    (accommodationId: number) => {
      updateRecentlyViewedWishlistStateInCache(
        queryClient,
        accommodationId,
        (isInWishlist) => !isInWishlist
      );
    },
    [queryClient]
  );

  const refreshRecentlyViewedWishlistState = useCallback(
    async (accommodationId: number) => {
      clearError();

      try {
        const membership =
          await fetchAccommodationWishlistMembership(accommodationId);
        setAccommodationScopedWishlistMembershipCache(
          queryClient,
          accommodationId,
          membership,
        );

        updateRecentlyViewedWishlistStateInCache(
          queryClient,
          accommodationId,
          () => membership.isInAnyWishlist,
        );
      } catch (err) {
        handleError(err);
      }
    },
    [clearError, handleError, queryClient]
  );

  const isDetailQueryEnabled =
    Boolean(selectedWishlistId) && !showRecentlyViewed;
  const isLoading = useMemo(
    () =>
      recentlyViewedQuery.isFetching ||
      wishlistsQuery.isLoading ||
      (isDetailQueryEnabled &&
        wishlistDetailQuery.isFetching &&
        !wishlistDetailQuery.isFetchingNextPage),
    [
      isDetailQueryEnabled,
      recentlyViewedQuery.isFetching,
      wishlistDetailQuery.isFetching,
      wishlistDetailQuery.isFetchingNextPage,
      wishlistsQuery.isLoading,
    ]
  );

  return {
    clearError,
    deleteWishlist,
    error,
    hasNext: wishlistDetailQuery.hasNextPage,
    isLoading,
    isMutationPending: pendingMutationKeys.size > 0,
    isLoadingMore: wishlistDetailQuery.isFetchingNextPage,
    isLoadingMoreWishlists: wishlistsQuery.isFetchingNextPage,
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
    wishlistsHasNext: wishlistsQuery.hasNextPage,
  };
}
