import { useCallback, useState } from "react";
import { wishlistApi } from "../../../api";
import { AccommodationSearchInfo } from "../../../types/accommodation";

type SetAccommodations = React.Dispatch<
  React.SetStateAction<AccommodationSearchInfo[]>
>;

interface UseSearchWishlistModalOptions {
  isAuthenticated: boolean;
  setAccommodations: SetAccommodations;
}

export function useSearchWishlistModal({
  isAuthenticated,
  setAccommodations,
}: UseSearchWishlistModalOptions) {
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false);
  const [
    selectedAccommodationForWishlist,
    setSelectedAccommodationForWishlist,
  ] = useState<number | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const openWishlistModal = useCallback(
    (accommodationId: number) => {
      if (!isAuthenticated) {
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
  }, []);

  const closeWishlistModal = useCallback(async () => {
    if (selectedAccommodationForWishlist) {
      try {
        const response = await wishlistApi.getWishlists({
          size: 20,
          accommodationId: selectedAccommodationForWishlist,
        });
        const isInAnyWishlist =
          response?.wishlists?.some((wishlist) => wishlist.is_contained) ||
          false;

        setAccommodations((prev) =>
          prev.map((accommodation) =>
            accommodation.id === selectedAccommodationForWishlist
              ? { ...accommodation, is_in_wishlist: isInAnyWishlist }
              : accommodation
          )
        );
      } catch (error) {
        console.error("위시리스트 상태 확인 실패:", error);
      }
    }

    setWishlistModalOpen(false);
    setSelectedAccommodationForWishlist(null);
  }, [selectedAccommodationForWishlist, setAccommodations]);

  return {
    authModalOpen,
    closeAuthModal,
    closeWishlistModal,
    openWishlistModal,
    selectedAccommodationForWishlist,
    wishlistModalOpen,
  };
}
