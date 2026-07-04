import React from "react";
import { ErrorToast } from "../../components/ErrorToast";
import { useIntersectionLoadMore } from "../../hooks/useIntersectionLoadMore";
import { routeTo } from "../../routes/paths";
import { WishlistAccommodationInfo } from "../../types/wishlist";
import {
  RecentlyViewedView,
  WishlistDetailView,
  WishlistIndexView,
  WishlistMemoDialog,
} from "./components";
import { WishlistModal } from "./components/WishlistModal";
import {
  useWishlistData,
  useWishlistModals,
  useWishlistRouteViewState,
} from "./hooks";

interface WishlistRouteProps {
  className?: string;
  toastClassName?: string;
}

export const WishlistRoute: React.FC<WishlistRouteProps> = ({
  className,
  toastClassName,
}) => {
  const {
    backToIndex,
    clearSelectedWishlist,
    isEditMode,
    openRecentlyViewed,
    openWishlist,
    selectedWishlist,
    setIsEditMode,
    showRecentlyViewed,
  } = useWishlistRouteViewState();
  const {
    clearError,
    deleteWishlist,
    error,
    hasNext,
    isLoading,
    isLoadingMore,
    isLoadingMoreWishlists,
    loadMoreWishlistAccommodations,
    loadMoreWishlists,
    recentlyViewed,
    refreshRecentlyViewedWishlistState,
    reloadRecentlyViewed,
    removeFromWishlist,
    removeRecentlyViewed,
    saveWishlistAccommodationMemo,
    toggleRecentlyViewedWishlistState,
    wishlistAccommodations,
    wishlists,
    wishlistsHasNext,
  } = useWishlistData({
    selectedWishlistId: selectedWishlist,
    showRecentlyViewed,
  });
  const {
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
  } = useWishlistModals();
  const setWishlistsObserverTarget = useIntersectionLoadMore({
    disabled: Boolean(selectedWishlist || showRecentlyViewed),
    hasNext: wishlistsHasNext,
    isLoading: isLoadingMoreWishlists,
    onLoadMore: loadMoreWishlists,
  });
  const setWishlistAccommodationsObserverTarget = useIntersectionLoadMore({
    disabled: !selectedWishlist || showRecentlyViewed,
    hasNext,
    isLoading: isLoadingMore,
    onLoadMore: loadMoreWishlistAccommodations,
  });

  const handleRecentlyViewedClick = async () => {
    openRecentlyViewed();
    await reloadRecentlyViewed();
  };

  const handleWishlistSuccess = () => {
    if (selectedAccommodationForWishlist !== null) {
      toggleRecentlyViewedWishlistState(selectedAccommodationForWishlist);
    }
  };

  const handleOpenMemoModal = (item: WishlistAccommodationInfo) => {
    openMemoModal(item);
  };

  const handleSaveMemo = async () => {
    if (!selectedMemoItem || !memoText.trim()) return;

    const isSaved = await saveWishlistAccommodationMemo(
      selectedMemoItem.wishlist_accommodation_id,
      memoText
    );

    if (isSaved) {
      closeMemoModal();
    }
  };

  const handleDeleteWishlist = async (
    wishlistId: number,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
    const isDeleted = await deleteWishlist(wishlistId);

    if (isDeleted && selectedWishlist === wishlistId) {
      clearSelectedWishlist();
    }
  };

  const handleAccommodationDetailClick = (accommodationId: number) => {
    window.open(routeTo.accommodationDetail(accommodationId), "_blank");
  };

  return (
    <div className={className}>
      {showRecentlyViewed ? (
        <RecentlyViewedView
          isEditMode={isEditMode}
          onBack={backToIndex}
          onOpenAccommodationDetail={handleAccommodationDetailClick}
          onRemoveRecentlyViewed={removeRecentlyViewed}
          onToggleEditMode={() => setIsEditMode(!isEditMode)}
          onWishlistToggle={openWishlistModal}
          recentlyViewed={recentlyViewed}
        />
      ) : selectedWishlist ? (
        <WishlistDetailView
          hasNext={hasNext}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          onBack={backToIndex}
          onOpenAccommodationDetail={handleAccommodationDetailClick}
          onOpenMemo={handleOpenMemoModal}
          onRemoveFromWishlist={removeFromWishlist}
          selectedWishlistId={selectedWishlist}
          setWishlistAccommodationsObserverTarget={
            setWishlistAccommodationsObserverTarget
          }
          wishlistAccommodations={wishlistAccommodations}
          wishlists={wishlists}
        />
      ) : (
        <WishlistIndexView
          isLoading={isLoading}
          isLoadingMoreWishlists={isLoadingMoreWishlists}
          onDeleteWishlist={handleDeleteWishlist}
          onOpenRecentlyViewed={handleRecentlyViewedClick}
          onOpenWishlist={openWishlist}
          recentlyViewed={recentlyViewed}
          setWishlistsObserverTarget={setWishlistsObserverTarget}
          wishlists={wishlists}
          wishlistsHasNext={wishlistsHasNext}
        />
      )}

      {error && (
        <div className={toastClassName}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}

      {selectedAccommodationForWishlist !== null && (
        <WishlistModal
          isOpen={wishlistModalOpen}
          onClose={async () => {
            try {
              await refreshRecentlyViewedWishlistState(
                selectedAccommodationForWishlist
              );
            } catch (err) {
              console.error("위시리스트 상태 확인 실패:", err);
            }

            closeWishlistModal();
          }}
          accommodationId={selectedAccommodationForWishlist}
          onSuccess={handleWishlistSuccess}
        />
      )}

      <WishlistMemoDialog
        isOpen={memoModalOpen}
        memoText={memoText}
        onChangeMemoText={updateMemoText}
        onClear={clearMemoText}
        onClose={closeMemoModal}
        onSave={handleSaveMemo}
      />
    </div>
  );
};
