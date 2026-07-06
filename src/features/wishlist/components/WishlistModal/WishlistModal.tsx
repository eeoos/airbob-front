import React, { useEffect, useRef } from "react";
import { useWishlistSelection } from "../../hooks/useWishlistSelection";
import type { WishlistModalItemViewModel } from "../../lib/wishlistAccommodationViewModel";
import { Dialog } from "../../../../shared/ui";
import { CreateWishlistModal } from "../CreateWishlistModal/CreateWishlistModal";
import { ErrorToast } from "../../../../components/ErrorToast";
import styles from "./WishlistModal.module.css";

interface WishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  accommodationId: number;
  onSuccess?: () => void;
}

export const WishlistModal: React.FC<WishlistModalProps> = ({
  isOpen,
  onClose,
  accommodationId,
  onSuccess,
}) => {
  const {
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
  } = useWishlistSelection({
    isOpen,
    accommodationId,
    onSuccess,
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  // 무한스크롤 설정
  useEffect(() => {
    if (!isOpen || !hasNext || isLoading) {
      // observer 정리
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isLoading) {
          loadMoreWishlists();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isOpen, hasNext, isLoading, loadMoreWishlists]);

  // 위시리스트에 숙소 추가/삭제
  const handleWishlistClick = async (
    wishlist: WishlistModalItemViewModel,
    e?: React.MouseEvent,
  ) => {
    await toggleWishlist(wishlist, e);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <Dialog
        isOpen={isOpen}
        title="위시리스트에 저장하기"
        onClose={onClose}
        className={styles.dialog}
        bodyClassName={styles.content}
      >
        <div className={styles.wishlistGrid} ref={scrollContainerRef}>
          {wishlists.map((wishlist) => (
            <button
              type="button"
              key={wishlist.id}
              className={styles.wishlistItem}
              aria-pressed={wishlist.isContained}
              onClick={(e) => handleWishlistClick(wishlist, e)}
            >
              <div className={styles.wishlistImage}>
                {wishlist.thumbnailUrl ? (
                  <>
                    <img
                      src={wishlist.thumbnailUrl}
                      alt={wishlist.name}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const placeholder =
                          target.nextElementSibling as HTMLElement;
                        if (
                          placeholder &&
                          placeholder.classList.contains(
                            styles.placeholderImage,
                          )
                        ) {
                          placeholder.hidden = false;
                          placeholder.style.display = "flex";
                        }
                      }}
                    />
                    <div
                      className={`${styles.placeholderImage} ${styles.placeholderImageHidden}`}
                      hidden
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                  </>
                ) : (
                  <div className={styles.placeholderImage}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </div>
                )}
                <div
                  className={`${styles.wishlistIcon} ${
                    wishlist.isContained ? styles.active : ""
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill={wishlist.isContained ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </div>
              </div>
              <div className={styles.wishlistInfo}>
                <div className={styles.wishlistName}>{wishlist.name}</div>
                <div className={styles.wishlistCount}>
                  {wishlist.itemCountLabel}
                </div>
              </div>
            </button>
          ))}
          <div ref={loadingRef} className={styles.loadingIndicator}>
            {hasNext && isLoading && "로딩 중..."}
          </div>
        </div>

        <button className={styles.createButton} onClick={openCreateModal}>
          새로운 위시리스트 만들기
        </button>
        {error && (
          <div className={styles.toastContainer}>
            <ErrorToast message={error} onClose={clearError} />
          </div>
        )}
      </Dialog>

      <CreateWishlistModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
};
