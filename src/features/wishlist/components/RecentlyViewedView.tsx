import { groupRecentlyViewedByDate } from "../lib/recentlyViewedGroups";
import type { RecentlyViewedAccommodationCardViewModel } from "../lib/wishlistAccommodationViewModel";
import styles from "./WishlistViews.module.css";

interface RecentlyViewedViewProps {
  isEditMode: boolean;
  onBack: () => void;
  onOpenAccommodationDetail: (accommodationId: number) => void;
  onRemoveRecentlyViewed: (accommodationId: number) => void;
  onToggleEditMode: () => void;
  onWishlistToggle: (accommodationId: number) => void;
  recentlyViewed: RecentlyViewedAccommodationCardViewModel[];
}

export function RecentlyViewedView({
  isEditMode,
  onBack,
  onOpenAccommodationDetail,
  onRemoveRecentlyViewed,
  onToggleEditMode,
  onWishlistToggle,
  recentlyViewed,
}: RecentlyViewedViewProps) {
  return (
    <>
      <div className={styles.recentlyViewedHeader}>
        <div className={styles.recentlyViewedHeaderLeft}>
          <button className={styles.backButton} onClick={onBack} type="button">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className={styles.recentlyViewedTitle}>최근 조회</h1>
        </div>
        {recentlyViewed.length > 0 && (
          <button
            className={styles.editButton}
            onClick={onToggleEditMode}
            type="button"
          >
            {isEditMode ? "완료" : "수정"}
          </button>
        )}
      </div>
      {recentlyViewed.length === 0 ? (
        <div className={styles.empty}>최근 조회한 숙소가 없습니다.</div>
      ) : (
        <>
          {Object.entries(groupRecentlyViewedByDate(recentlyViewed)).map(
            ([date, items]) => (
              <div key={date} className={styles.dateSection}>
                <h2 className={styles.dateTitle}>{date}</h2>
                <div className={styles.recentlyViewedGrid}>
                  {items.map((item) => (
                    <div
                      key={item.accommodationId}
                      className={styles.recentlyViewedCard}
                    >
                      <button
                        className={styles.cardActionButton}
                        type="button"
                        onClick={() =>
                          onOpenAccommodationDetail(item.accommodationId)
                        }
                      >
                        <div className={styles.recentlyViewedImageWrapper}>
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt={item.name} />
                          ) : (
                            <div className={styles.placeholderImage}>
                              이미지 없음
                            </div>
                          )}
                        </div>
                        <div className={styles.wishlistCardInfo}>
                          <div className={styles.locationRow}>
                            <div className={styles.location}>
                              {item.locationLabel}
                            </div>
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
                      {isEditMode && (
                        <button
                          className={styles.deleteButtonLeft}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveRecentlyViewed(item.accommodationId);
                          }}
                          aria-label="삭제"
                          type="button"
                        >
                          ✕
                        </button>
                      )}
                      {!isEditMode && (
                        <button
                          className={styles.wishlistButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            onWishlistToggle(item.accommodationId);
                          }}
                          aria-label="위시리스트"
                          type="button"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill={item.isInWishlist ? "#ff385c" : "none"}
                            stroke={item.isInWishlist ? "#ffffff" : "#222222"}
                            strokeWidth="1.5"
                          >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </>
      )}
    </>
  );
}
