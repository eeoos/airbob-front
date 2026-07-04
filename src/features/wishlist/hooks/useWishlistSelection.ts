import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { wishlistApi } from "../../../api/wishlist";
import { useApiError } from "../../../hooks/useApiError";
import { WishlistInfo } from "../../../types/wishlist";
import { searchQueryKeys } from "../../search/queryKeys";
import { wishlistQueryKeys } from "../queryKeys";

const WISHLIST_PAGE_SIZE = 20;

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
  const [wishlists, setWishlists] = useState<WishlistInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { error, handleError, clearError } = useApiError();

  const fetchWishlists = useCallback(
    async (cursor?: string | null) => {
      setIsLoading(true);
      clearError();

      try {
        const response = await wishlistApi.getWishlists({
          size: WISHLIST_PAGE_SIZE,
          cursor: cursor || undefined,
          accommodationId,
        });

        if (cursor) {
          setWishlists((prev) => [...prev, ...(response?.wishlists || [])]);
        } else {
          setWishlists(response?.wishlists || []);
        }

        setHasNext(response?.page_info?.has_next || false);
        setNextCursor(response?.page_info?.next_cursor || null);
      } catch (error) {
        handleError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [accommodationId, clearError, handleError]
  );

  useEffect(() => {
    if (isOpen) {
      fetchWishlists();
      return;
    }

    setWishlists([]);
    setHasNext(false);
    setNextCursor(null);
    clearError();
  }, [clearError, fetchWishlists, isOpen]);

  const loadMoreWishlists = useCallback(async () => {
    if (!hasNext || isLoading || !nextCursor) {
      return;
    }

    await fetchWishlists(nextCursor);
  }, [fetchWishlists, hasNext, isLoading, nextCursor]);

  const invalidateMutationCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: wishlistQueryKeys.all });
    queryClient.invalidateQueries({
      queryKey: wishlistQueryKeys.recentlyViewed(),
    });
    queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
  }, [queryClient]);

  const toggleWishlist = useCallback(
    async (wishlist: WishlistInfo, event?: { stopPropagation: () => void }) => {
      event?.stopPropagation();

      try {
        if (wishlist.is_contained && wishlist.wishlist_accommodation_id) {
          await wishlistApi.removeAccommodation(
            wishlist.wishlist_accommodation_id
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
