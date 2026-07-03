import { useCallback, useState } from "react";
import { WishlistAccommodationInfo } from "../../../types/wishlist";

export function useWishlistModals() {
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false);
  const [selectedAccommodationForWishlist, setSelectedAccommodationForWishlist] =
    useState<number | null>(null);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [selectedMemoItem, setSelectedMemoItem] =
    useState<WishlistAccommodationInfo | null>(null);
  const [memoText, setMemoText] = useState("");

  const openWishlistModal = useCallback((accommodationId: number) => {
    setSelectedAccommodationForWishlist(accommodationId);
    setWishlistModalOpen(true);
  }, []);

  const closeWishlistModal = useCallback(() => {
    setWishlistModalOpen(false);
    setSelectedAccommodationForWishlist(null);
  }, []);

  const openMemoModal = useCallback((item: WishlistAccommodationInfo) => {
    setSelectedMemoItem(item);
    setMemoText(item.memo || "");
    setMemoModalOpen(true);
  }, []);

  const closeMemoModal = useCallback(() => {
    setMemoModalOpen(false);
    setSelectedMemoItem(null);
    setMemoText("");
  }, []);

  const updateMemoText = useCallback((value: string) => {
    setMemoText(value.slice(0, 250));
  }, []);

  const clearMemoText = useCallback(() => {
    setMemoText("");
  }, []);

  return {
    clearMemoText,
    closeMemoModal,
    closeWishlistModal,
    memoModalOpen,
    memoText,
    openMemoModal,
    openWishlistModal,
    selectedAccommodationForWishlist,
    selectedMemoItem,
    updateMemoText,
    wishlistModalOpen,
  };
}
