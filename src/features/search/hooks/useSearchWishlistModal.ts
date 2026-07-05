import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { WishlistInfos } from "../../../types/wishlist";
import { getWishlistListsParamsSignature } from "../../wishlist/hooks/useWishlistListsQuery";
import { fetchAccommodationWishlistMembership } from "../../wishlist/lib/wishlistMembership";
import { wishlistQueryKeys } from "../../wishlist/queryKeys";

interface UseSearchWishlistModalOptions {
  isAuthenticated: boolean;
  onWishlistStatusChange: (
    accommodationId: number,
    isInWishlist: boolean
  ) => void;
}

export function useSearchWishlistModal({
  isAuthenticated,
  onWishlistStatusChange,
}: UseSearchWishlistModalOptions) {
  const queryClient = useQueryClient();
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false);
  const [
    selectedAccommodationForWishlist,
    setSelectedAccommodationForWishlist,
  ] = useState<number | null>(null);
  const [pendingAccommodationForWishlist, setPendingAccommodationForWishlist] =
    useState<number | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const openWishlistModal = useCallback(
    (accommodationId: number) => {
      if (!isAuthenticated) {
        setPendingAccommodationForWishlist(accommodationId);
        setAuthModalOpen(true);
        return;
      }

      setSelectedAccommodationForWishlist(accommodationId);
      setWishlistModalOpen(true);
    },
    [isAuthenticated]
  );

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setPendingAccommodationForWishlist(null);
  }, []);

  const handleAuthSuccess = useCallback(() => {
    setAuthModalOpen(false);

    if (pendingAccommodationForWishlist !== null) {
      setSelectedAccommodationForWishlist(pendingAccommodationForWishlist);
      setPendingAccommodationForWishlist(null);
      setWishlistModalOpen(true);
    }
  }, [pendingAccommodationForWishlist]);

  const closeWishlistModal = useCallback(async () => {
    if (selectedAccommodationForWishlist !== null) {
      try {
        const { isInAnyWishlist, pageParams, pages } =
          await fetchAccommodationWishlistMembership(
            selectedAccommodationForWishlist
          );

        queryClient.setQueryData<InfiniteData<WishlistInfos, string | null>>(
          wishlistQueryKeys.lists(
            getWishlistListsParamsSignature({
              accommodationId: selectedAccommodationForWishlist,
            })
          ),
          {
            pageParams,
            pages,
          }
        );

        onWishlistStatusChange(
          selectedAccommodationForWishlist,
          isInAnyWishlist
        );
      } catch (error) {
        console.error("위시리스트 상태 확인 실패:", error);
      }
    }

    setWishlistModalOpen(false);
    setSelectedAccommodationForWishlist(null);
  }, [onWishlistStatusChange, queryClient, selectedAccommodationForWishlist]);

  return {
    authModalOpen,
    closeAuthModal,
    closeWishlistModal,
    handleAuthSuccess,
    openWishlistModal,
    pendingAccommodationForWishlist,
    selectedAccommodationForWishlist,
    wishlistModalOpen,
  };
}
