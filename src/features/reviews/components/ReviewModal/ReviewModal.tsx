import React, { useState, useEffect } from "react";
import { Dialog } from "../../../../shared/ui";
import type { ReviewViewModel } from "../../lib/reviewViewModel";
import styles from "./ReviewModal.module.css";

type ReviewSortType = "LATEST" | "HIGHEST_RATING" | "LOWEST_RATING";

const REVIEW_SORT_TYPE = {
  LATEST: "LATEST",
  HIGHEST_RATING: "HIGHEST_RATING",
  LOWEST_RATING: "LOWEST_RATING",
} as const satisfies Record<ReviewSortType, ReviewSortType>;

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviews: ReviewViewModel[];
  averageRating: number;
  totalCount: number;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  reviews,
  averageRating,
  totalCount,
}) => {
  const [sortType, setSortType] = useState<ReviewSortType>(
    REVIEW_SORT_TYPE.LATEST,
  );
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const sortContainer = document.querySelector(`.${styles.sortContainer}`);
      if (isSortDropdownOpen && sortContainer && !sortContainer.contains(target)) {
        setIsSortDropdownOpen(false);
      }
    };

    if (isSortDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSortDropdownOpen]);

  if (!isOpen) return null;

  const sortedReviews = [...reviews].sort((a, b) => {
    switch (sortType) {
      case REVIEW_SORT_TYPE.LATEST:
        return b.date.timestamp - a.date.timestamp;
      case REVIEW_SORT_TYPE.HIGHEST_RATING:
        return b.rating - a.rating;
      case REVIEW_SORT_TYPE.LOWEST_RATING:
        return a.rating - b.rating;
      default:
        return 0;
    }
  });

  const filteredReviews = sortedReviews;

  const getSortLabel = (type: ReviewSortType): string => {
    switch (type) {
      case REVIEW_SORT_TYPE.LATEST:
        return "최신순";
      case REVIEW_SORT_TYPE.HIGHEST_RATING:
        return "높은 평점순";
      case REVIEW_SORT_TYPE.LOWEST_RATING:
        return "낮은 평점순";
      default:
        return "최신순";
    }
  };

  return (
    <Dialog
      bodyClassName={styles.modalContent}
      bodyPadding="none"
      className={styles.dialog}
      isOpen={isOpen}
      onClose={onClose}
      showHeader={false}
      size="xl"
      title={`후기 ${totalCount}개`}
    >
      <button
        aria-label="후기 모달 닫기"
        autoFocus
        className={styles.closeButton}
        type="button"
        onClick={onClose}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>

      <div className={styles.modalHeader}>
        <div className={styles.headerTitle}>
          <span className={styles.rating}>★ {averageRating.toFixed(2)}</span>
          <span className={styles.reviewCount}>후기 {totalCount}개</span>
        </div>
        <div className={styles.sortContainer}>
          <button
            className={styles.sortButton}
            type="button"
            onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
          >
            {getSortLabel(sortType)}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {isSortDropdownOpen && (
            <div className={styles.sortDropdown}>
              <button
                className={
                  sortType === REVIEW_SORT_TYPE.LATEST
                    ? styles.sortOptionActive
                    : styles.sortOption
                }
                type="button"
                onClick={() => {
                  setSortType(REVIEW_SORT_TYPE.LATEST);
                  setIsSortDropdownOpen(false);
                }}
              >
                최신순
              </button>
              <button
                className={
                  sortType === REVIEW_SORT_TYPE.HIGHEST_RATING
                    ? styles.sortOptionActive
                    : styles.sortOption
                }
                type="button"
                onClick={() => {
                  setSortType(REVIEW_SORT_TYPE.HIGHEST_RATING);
                  setIsSortDropdownOpen(false);
                }}
              >
                높은 평점순
              </button>
              <button
                className={
                  sortType === REVIEW_SORT_TYPE.LOWEST_RATING
                    ? styles.sortOptionActive
                    : styles.sortOption
                }
                type="button"
                onClick={() => {
                  setSortType(REVIEW_SORT_TYPE.LOWEST_RATING);
                  setIsSortDropdownOpen(false);
                }}
              >
                낮은 평점순
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.reviewsList}>
        {filteredReviews.map((review) => (
          <div key={review.id} className={styles.reviewItem}>
            <div className={styles.reviewerInfo}>
              {review.author.avatarUrl ? (
                <img
                  src={review.author.avatarUrl}
                  alt={review.author.name}
                  className={styles.reviewerAvatar}
                />
              ) : (
                <div className={styles.reviewerAvatarPlaceholder}>
                  {review.author.avatarInitial}
                </div>
              )}
              <div className={styles.reviewerDetails}>
                <div className={styles.reviewerName}>{review.author.name}</div>
              </div>
            </div>

            <div className={styles.reviewRating}>
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className={i < review.rating ? styles.starIconFilled : styles.starIcon}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>

            <div className={styles.reviewDate}>
              {review.date.label}
            </div>

            <div className={styles.reviewContent}>{review.content}</div>

            {review.images && review.images.length > 0 && (
              <div className={styles.reviewImages}>
                {review.images.map((image) => (
                  <img
                    key={image.id}
                    src={image.url}
                    alt={image.alt}
                    className={styles.reviewImage}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Dialog>
  );
};
