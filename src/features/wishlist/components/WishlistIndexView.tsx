import React from "react";
import type { WishlistIndexCardViewModel } from "../lib/wishlistAccommodationViewModel";
import styles from "./WishlistViews.module.css";

interface WishlistIndexViewProps {
  isLoading: boolean;
  isLoadingMoreWishlists: boolean;
  onDeleteWishlist: (
    wishlistId: number,
    event: React.MouseEvent<HTMLButtonElement>
  ) => void;
  onOpenRecentlyViewed: () => void;
  onOpenWishlist: (wishlistId: number) => void;
  recentlyViewedSummaryLabel: string;
  setWishlistsObserverTarget: (node: Element | null) => void;
  wishlists: WishlistIndexCardViewModel[];
  wishlistsHasNext: boolean;
}

export function WishlistIndexView({
  isLoading,
  isLoadingMoreWishlists,
  onDeleteWishlist,
  onOpenRecentlyViewed,
  onOpenWishlist,
  recentlyViewedSummaryLabel,
  setWishlistsObserverTarget,
  wishlists,
  wishlistsHasNext,
}: WishlistIndexViewProps) {
  return (
    <>
      <h1 className={styles.pageTitle}>위시리스트</h1>
      {isLoading &&
      recentlyViewedSummaryLabel === "항목 없음" &&
      wishlists.length === 0 ? (
        <div className={styles.loading}>로딩 중...</div>
      ) : (
        <div className={styles.wishlistGrid}>
          <button
            className={`${styles.wishlistCard} ${styles.cardActionButton}`}
            type="button"
            onClick={onOpenRecentlyViewed}
          >
            <div className={styles.wishlistCardImage}>
              <div className={styles.searchIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
            </div>
            <div className={styles.wishlistCardInfo}>
              <div className={styles.wishlistCardName}>최근 조회</div>
              <div className={styles.wishlistCardCount}>
                {recentlyViewedSummaryLabel}
              </div>
            </div>
          </button>

          {wishlists.map((wishlist) => (
            <div key={wishlist.id} className={styles.wishlistCard}>
              <button
                className={styles.cardActionButton}
                type="button"
                onClick={() => onOpenWishlist(wishlist.id)}
              >
                <div className={styles.wishlistCardImage}>
                  {wishlist.thumbnailUrl ? (
                    <img src={wishlist.thumbnailUrl} alt={wishlist.name} />
                  ) : (
                    <div className={styles.placeholderImage}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className={styles.wishlistCardInfo}>
                  <div className={styles.wishlistCardName}>{wishlist.name}</div>
                  <div className={styles.wishlistCardCount}>
                    {wishlist.itemCountLabel}
                  </div>
                </div>
              </button>
              <button
                className={styles.wishlistDeleteButton}
                onClick={(event) => onDeleteWishlist(wishlist.id, event)}
                aria-label="위시리스트 삭제"
                type="button"
              >
                ✕
              </button>
            </div>
          ))}
          {wishlistsHasNext && (
            <div
              ref={setWishlistsObserverTarget}
              className={styles.loadMoreContainer}
            >
              {isLoadingMoreWishlists && (
                <div className={styles.loadingMore}>로딩 중...</div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
