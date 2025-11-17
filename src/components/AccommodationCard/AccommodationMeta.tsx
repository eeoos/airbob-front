import React from "react";
import { ReviewSummary } from "../../types/accommodation";
import styles from "./AccommodationMeta.module.css";

interface AccommodationMetaProps {
  review: ReviewSummary;
  isInWishlist?: boolean;
  onWishlistToggle?: () => void;
}

export const AccommodationMeta: React.FC<AccommodationMetaProps> = ({
  review,
  isInWishlist = false,
  onWishlistToggle,
}) => {
  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onWishlistToggle) {
      onWishlistToggle();
    }
  };

  return (
    <div className={styles.meta}>
      {review.total_count > 0 && (
        <div className={styles.review}>
          <svg viewBox="0 0 24 24" fill="currentColor" className={styles.star}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className={styles.rating}>{review.average_rating.toFixed(1)}</span>
          <span className={styles.reviewCount}>({review.total_count})</span>
        </div>
      )}
      {onWishlistToggle && (
        <button
          className={`${styles.wishlistButton} ${isInWishlist ? styles.active : ""}`}
          onClick={handleWishlistClick}
        >
          <svg
            viewBox="0 0 24 24"
            fill={isInWishlist ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      )}
    </div>
  );
};





