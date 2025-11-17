import React, { useState, useEffect } from "react";
import { ReviewInfo } from "../../types/review";
import { ReviewSortType } from "../../types/enums";
import { getImageUrl } from "../../utils/image";
import styles from "./ReviewModal.module.css";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviews: ReviewInfo[];
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
  const [sortType, setSortType] = useState<ReviewSortType>(ReviewSortType.LATEST);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

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
      case ReviewSortType.LATEST:
        return new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime();
      case ReviewSortType.HIGHEST_RATING:
        return b.rating - a.rating;
      case ReviewSortType.LOWEST_RATING:
        return a.rating - b.rating;
      default:
        return 0;
    }
  });

  const filteredReviews = sortedReviews;

  const getSortLabel = (type: ReviewSortType): string => {
    switch (type) {
      case ReviewSortType.LATEST:
        return "최신순";
      case ReviewSortType.HIGHEST_RATING:
        return "높은 평점순";
      case ReviewSortType.LOWEST_RATING:
        return "낮은 평점순";
      default:
        return "최신순";
    }
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <div className={styles.headerTitle}>
              <span className={styles.rating}>★ {averageRating.toFixed(2)}</span>
              <span className={styles.reviewCount}>후기 {totalCount}개</span>
            </div>
            <div className={styles.sortContainer}>
              <button
                className={styles.sortButton}
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              >
                {getSortLabel(sortType)}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {isSortDropdownOpen && (
                <div className={styles.sortDropdown}>
                  <button
                    className={sortType === ReviewSortType.LATEST ? styles.sortOptionActive : styles.sortOption}
                    onClick={() => {
                      setSortType(ReviewSortType.LATEST);
                      setIsSortDropdownOpen(false);
                    }}
                  >
                    최신순
                  </button>
                  <button
                    className={sortType === ReviewSortType.HIGHEST_RATING ? styles.sortOptionActive : styles.sortOption}
                    onClick={() => {
                      setSortType(ReviewSortType.HIGHEST_RATING);
                      setIsSortDropdownOpen(false);
                    }}
                  >
                    높은 평점순
                  </button>
                  <button
                    className={sortType === ReviewSortType.LOWEST_RATING ? styles.sortOptionActive : styles.sortOption}
                    onClick={() => {
                      setSortType(ReviewSortType.LOWEST_RATING);
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
                  {review.reviewer.thumbnail_image_url ? (
                    <img
                      src={getImageUrl(review.reviewer.thumbnail_image_url)}
                      alt={review.reviewer.nickname}
                      className={styles.reviewerAvatar}
                    />
                  ) : (
                    <div className={styles.reviewerAvatarPlaceholder}>
                      {review.reviewer.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.reviewerDetails}>
                    <div className={styles.reviewerName}>{review.reviewer.nickname}</div>
                  </div>
                </div>

                <div className={styles.reviewRating}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      viewBox="0 0 24 24"
                      fill={i < review.rating ? "#222222" : "none"}
                      stroke={i < review.rating ? "#222222" : "#DDD"}
                      className={styles.starIcon}
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>

                <div className={styles.reviewDate}>
                  {new Date(review.reviewed_at).getFullYear()}년 {new Date(review.reviewed_at).getMonth() + 1}월
                </div>

                <div className={styles.reviewContent}>{review.content}</div>

                {review.images && review.images.length > 0 && (
                  <div className={styles.reviewImages}>
                    {review.images.map((image) => (
                      <img
                        key={image.id}
                        src={getImageUrl(image.image_url)}
                        alt="리뷰 이미지"
                        className={styles.reviewImage}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

