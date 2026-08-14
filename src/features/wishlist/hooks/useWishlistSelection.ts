import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { wishlistApi } from "../../../api/wishlist";
import { useApiError } from "../../../hooks/useApiError";
import { useHandledQueryError } from "../../../query/useHandledQueryError";
import { invalidateWishlistMutationCaches } from "../lib/wishlistCacheSync";
import {
  toWishlistModalItemViewModel,
} from "../lib/wishlistAccommodationViewModel";
import type { WishlistModalItemViewModel } from "../lib/wishlistAccommodationViewModel";
import { useWishlistListsQuery } from "./useWishlistListsQuery";

interface UseWishlistSelectionOptions {
  isOpen: boolean;
  accommodationId: number;
  onSuccess?: () => void;
}

export function useWishlistSelection({
  isOpen,
  accommodationId,
  onSuccess,
}: UseWishlistSelectionOptions) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingWishlistIds, setPendingWishlistIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const pendingWishlistIdsRef = useRef(new Set<number>());
  const { error, handleError, clearError } = useApiError();
  const wishlistsQuery = useWishlistListsQuery({
    accommodationId,
    enabled: isOpen,
  });

  useEffect(() => {
    clearError();
  }, [accommodationId, clearError, isOpen]);

  useHandledQueryError({
    error: wishlistsQuery.error,
    errorUpdatedAt: wishlistsQuery.errorUpdatedAt,
    isError: wishlistsQuery.isError,
    onError: handleError,
  });

  const wishlists = useMemo(
    () =>
      isOpen
        ? wishlistsQuery.data?.pages.flatMap((page) =>
            page.wishlists.map(toWishlistModalItemViewModel),
          ) ?? []
        : [],
    [isOpen, wishlistsQuery.data],
  );
  const isRefreshing = isOpen && wishlists.length > 0 && wishlistsQuery.isFetching;

  const setWishlistPending = useCallback((wishlistId: number, pending: boolean) => {
    const nextPendingIds = new Set(pendingWishlistIdsRef.current);

    if (pending) {
      nextPendingIds.add(wishlistId);
    } else {
      nextPendingIds.delete(wishlistId);
    }

    pendingWishlistIdsRef.current = nextPendingIds;
    setPendingWishlistIds(nextPendingIds);
  }, []);

  const refreshWishlists = useCallback(async () => {
    clearError();
    await wishlistsQuery.refetch({
      cancelRefetch: false,
      throwOnError: true,
    });
  }, [clearError, wishlistsQuery]);

  const loadMoreWishlists = useCallback(async () => {
    if (
      !wishlistsQuery.hasNextPage ||
      wishlistsQuery.isFetching
    ) {
      return;
    }

    clearError();
    await wishlistsQuery.fetchNextPage({ cancelRefetch: false });
  }, [clearError, wishlistsQuery]);

  const invalidateMutationCaches = useCallback(() => {
    invalidateWishlistMutationCaches(queryClient);
  }, [queryClient]);

  const toggleWishlist = useCallback(
    async (
      wishlist: WishlistModalItemViewModel,
      event?: { stopPropagation: () => void },
    ) => {
      event?.stopPropagation();

      if (
        !isOpen ||
        isRefreshing ||
        pendingWishlistIdsRef.current.has(wishlist.id)
      ) {
        return;
      }

      setWishlistPending(wishlist.id, true);

      try {
        try {
          if (
            wishlist.isContained &&
            wishlist.wishlistAccommodationId !== null
          ) {
            await wishlistApi.removeAccommodation(
              wishlist.wishlistAccommodationId,
            );
          } else {
            await wishlistApi.addAccommodation(wishlist.id, {
              accommodation_id: accommodationId,
            });
          }
        } catch (error) {
          handleError(error);
          return;
        }

        invalidateMutationCaches();

        try {
          await refreshWishlists();
        } catch (error) {
          handleError(error);
        }

        onSuccess?.();
      } finally {
        setWishlistPending(wishlist.id, false);
      }
    },
    [
      accommodationId,
      handleError,
      isOpen,
      isRefreshing,
      invalidateMutationCaches,
      onSuccess,
      refreshWishlists,
      setWishlistPending,
    ],
  );

  const openCreateModal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleCreateSuccess = useCallback(
    async (newWishlistId: number) => {
      setShowCreateModal(false);

      try {
        await wishlistApi.addAccommodation(newWishlistId, {
          accommodation_id: accommodationId,
        });
      } catch (error) {
        handleError(error);
        return;
      }

      invalidateMutationCaches();

      try {
        await refreshWishlists();
      } catch (error) {
        handleError(error);
      }

      onSuccess?.();
    },
    [
      accommodationId,
      handleError,
      invalidateMutationCaches,
      onSuccess,
      refreshWishlists,
    ],
  );

  return {
    closeCreateModal,
    clearError,
    error,
    handleCreateSuccess,
    hasNext: isOpen && Boolean(wishlistsQuery.hasNextPage),
    isRefreshing,
    isLoading:
      isOpen &&
      (wishlistsQuery.isLoading ||
        (wishlistsQuery.isFetching && wishlists.length === 0)),
    loadMoreWishlists,
    openCreateModal,
    pendingWishlistIds,
    showCreateModal,
    toggleWishlist,
    wishlists,
  };
}
