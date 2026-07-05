import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { wishlistApi } from "../../../api/wishlist";
import { useApiError } from "../../../hooks/useApiError";
import { invalidateWishlistMutationCaches } from "../lib/wishlistCacheSync";
import {
  toWishlistModalItemViewModel,
} from "../lib/wishlistAccommodationViewModel";
import type { WishlistModalItemViewModel } from "../lib/wishlistAccommodationViewModel";
import { getWishlistListParams } from "../lib/wishlistListQueryParams";

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
  const requestSequenceRef = useRef(0);
  const [wishlists, setWishlists] = useState<WishlistModalItemViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { error, handleError, clearError } = useApiError();

  const resetSelectionState = useCallback(() => {
    requestSequenceRef.current += 1;
    setWishlists([]);
    setIsLoading(false);
    setHasNext(false);
    setNextCursor(null);
    clearError();
  }, [clearError]);

  const fetchWishlists = useCallback(
    async (cursor?: string | null) => {
      const requestId = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestId;
      setIsLoading(true);
      clearError();

      try {
        const response = await wishlistApi.getWishlists(
          getWishlistListParams({
            cursor: cursor || undefined,
            accommodationId,
          }),
        );
        const modalWishlists = (response?.wishlists || []).map(
          toWishlistModalItemViewModel,
        );

        if (requestId !== requestSequenceRef.current) {
          return;
        }

        if (cursor) {
          setWishlists((prev) => [...prev, ...modalWishlists]);
        } else {
          setWishlists(modalWishlists);
        }

        setHasNext(response?.page_info?.has_next || false);
        setNextCursor(response?.page_info?.next_cursor || null);
      } catch (error) {
        if (requestId !== requestSequenceRef.current) {
          return;
        }

        handleError(error);
      } finally {
        if (requestId === requestSequenceRef.current) {
          setIsLoading(false);
        }
      }
    },
    [accommodationId, clearError, handleError]
  );

  useEffect(() => {
    if (!isOpen) {
      resetSelectionState();
      return;
    }

    resetSelectionState();
    fetchWishlists();
  }, [fetchWishlists, isOpen, resetSelectionState]);

  const loadMoreWishlists = useCallback(async () => {
    if (!hasNext || isLoading || !nextCursor) {
      return;
    }

    await fetchWishlists(nextCursor);
  }, [fetchWishlists, hasNext, isLoading, nextCursor]);

  const invalidateMutationCaches = useCallback(() => {
    invalidateWishlistMutationCaches(queryClient);
  }, [queryClient]);

  const toggleWishlist = useCallback(
    async (
      wishlist: WishlistModalItemViewModel,
      event?: { stopPropagation: () => void },
    ) => {
      event?.stopPropagation();

      try {
        if (
          wishlist.isContained &&
          wishlist.wishlistAccommodationId !== null
        ) {
          await wishlistApi.removeAccommodation(
            wishlist.wishlistAccommodationId
          );
        } else {
          await wishlistApi.addAccommodation(wishlist.id, {
            accommodation_id: accommodationId,
          });
        }

        invalidateMutationCaches();
        await fetchWishlists();
        onSuccess?.();
      } catch (error) {
        handleError(error);
      }
    },
    [
      accommodationId,
      fetchWishlists,
      handleError,
      invalidateMutationCaches,
      onSuccess,
    ]
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
        invalidateMutationCaches();
        await fetchWishlists();
        onSuccess?.();
      } catch (error) {
        handleError(error);
      }
    },
    [
      accommodationId,
      fetchWishlists,
      handleError,
      invalidateMutationCaches,
      onSuccess,
    ]
  );

  return {
    closeCreateModal,
    clearError,
    error,
    handleCreateSuccess,
    hasNext,
    isLoading,
    loadMoreWishlists,
    openCreateModal,
    showCreateModal,
    toggleWishlist,
    wishlists,
  };
}
