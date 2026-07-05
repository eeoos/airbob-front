import React from "react";
import { ListContainer } from "../../../components/ListContainer";
import {
  toWishlistAccommodationMemoTarget,
  WishlistAccommodationCardViewModel,
  WishlistAccommodationMemoTarget,
} from "../lib/wishlistAccommodationViewModel";
import styles from "./WishlistViews.module.css";

interface WishlistDetailViewProps {
  hasNext: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onBack: () => void;
  onOpenAccommodationDetail: (accommodationId: number) => void;
  onOpenMemo: (item: WishlistAccommodationMemoTarget) => void;
  onRemoveFromWishlist: (wishlistAccommodationId: number) => void;
  selectedWishlistName?: string;
  setWishlistAccommodationsObserverTarget: (node: Element | null) => void;
  wishlistAccommodations: WishlistAccommodationCardViewModel[];
}

const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const target = event.target as HTMLImageElement;
  target.style.display = "none";

  const placeholder = target.nextElementSibling as HTMLElement | null;
  if (placeholder?.classList.contains(styles.placeholderImage)) {
    placeholder.style.display = "flex";
  }
};

export function WishlistDetailView({
  hasNext,
  isLoading,
  isLoadingMore,
  onBack,
  onOpenAccommodationDetail,
  onOpenMemo,
  onRemoveFromWishlist,
  selectedWishlistName,
  setWishlistAccommodationsObserverTarget,
  wishlistAccommodations,
}: WishlistDetailViewProps) {
  return (
    <>
      <div className={styles.recentlyViewedHeader}>
        <div className={styles.recentlyViewedHeaderLeft}>
          <button className={styles.backButton} onClick={onBack} type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className={styles.recentlyViewedTitle}>{selectedWishlistName}</h1>
        </div>
      </div>
      {isLoading ? (
        <div className={styles.loading}>로딩 중...</div>
      ) : wishlistAccommodations.length === 0 ? (
        <div className={styles.empty}>위시리스트가 비어있습니다.</div>
      ) : (
        <>
          <ListContainer columns={4} gap={40}>
            {wishlistAccommodations.map((item) => (
              <div
                key={item.wishlistAccommodationId}
                className={styles.accommodationCard}
              >
                <button
                  className={styles.cardActionButton}
                  type="button"
                  onClick={() => onOpenAccommodationDetail(item.accommodationId)}
                >
                  <div className={styles.wishlistCardImage}>
                    {item.thumbnailUrl ? (
                      <>
                        <img
                          src={item.thumbnailUrl}
                          alt={item.name}
                          onError={handleImageError}
                        />
                        <div
                          className={styles.placeholderImage}
                          style={{ display: "none" }}
                        >
                          이미지 없음
                        </div>
                      </>
                    ) : (
                      <div className={styles.placeholderImage}>이미지 없음</div>
                    )}
                  </div>
                  <div className={styles.wishlistCardInfo}>
                    <div className={styles.locationRow}>
                      <div className={styles.location}>{item.locationLabel}</div>
                      {item.showReview && (
                        <div className={styles.review}>
                          <span className={styles.star}>★</span>
                          <span className={styles.rating}>
                            {item.reviewRatingLabel}
                          </span>
                          <span className={styles.reviewCount}>
                            {item.reviewCountLabel}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={styles.name}>{item.name}</div>
                  </div>
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveFromWishlist(item.wishlistAccommodationId);
                  }}
                  aria-label="삭제"
                  type="button"
                >
                  ✕
                </button>
                <button
                  type="button"
                  className={styles.memoArea}
                  onClick={() =>
                    onOpenMemo(toWishlistAccommodationMemoTarget(item))
                  }
                >
                  {item.memo ? (
                    <span className={styles.memoText}>
                      {item.memo} <span className={styles.memoEdit}>수정</span>
                    </span>
                  ) : (
                    <span className={styles.memoAdd}>메모 추가</span>
                  )}
                </button>
              </div>
            ))}
          </ListContainer>
          {hasNext && (
            <div
              ref={setWishlistAccommodationsObserverTarget}
              className={styles.loadMoreContainer}
            >
              {isLoadingMore && (
                <div className={styles.loadingMore}>로딩 중...</div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
