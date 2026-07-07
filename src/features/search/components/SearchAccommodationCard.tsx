import React from "react";
import { routeTo } from "../../../routes/paths";
import {
  getSearchAccommodationPriceDisplay,
  SearchAccommodationCardViewModel,
} from "../lib/searchAccommodationViewModel";
import styles from "./SearchAccommodationCard.module.css";

interface SearchAccommodationCardProps {
  accommodation: SearchAccommodationCardViewModel;
  detailUrl?: string;
  onWishlistToggle?: () => void;
  onClick?: () => void;
  checkIn?: string | null;
  checkOut?: string | null;
}

export const SearchAccommodationCard: React.FC<SearchAccommodationCardProps> = ({
  accommodation,
  detailUrl: providedDetailUrl,
  onWishlistToggle,
  onClick,
  checkIn,
  checkOut,
}) => {
  const detailUrl =
    providedDetailUrl ?? routeTo.accommodationDetail(accommodation.id);
  const priceDisplay = getSearchAccommodationPriceDisplay(
    accommodation,
    checkIn,
    checkOut,
  );

  const handleCardClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      event.preventDefault();
      onClick();
    }
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onWishlistToggle) {
      onWishlistToggle();
    }
  };

  return (
    <div className={styles.accommodationCard} data-testid="search-result-card">
      <a
        href={detailUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.cardLink}
        aria-label={`숙소 상세 보기: ${accommodation.name}`}
        onClick={handleCardClick}
      >
        <div className={styles.wishlistCardImage}>
          {accommodation.thumbnailUrl ? (
            <>
              <img
                src={accommodation.thumbnailUrl}
                alt={accommodation.name}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  const placeholder = target.nextElementSibling as HTMLElement;
                  if (placeholder && placeholder.classList.contains(styles.placeholderImage)) {
                    placeholder.hidden = false;
                    placeholder.style.display = "flex";
                  }
                }}
              />
              <div
                className={`${styles.placeholderImage} ${styles.placeholderImageHidden}`}
                hidden
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
            <div className={styles.location}>
              {accommodation.locationLabel}
            </div>
            {accommodation.showReview && (
              <div className={styles.review}>
                <span className={styles.star}>★</span>
                <span className={styles.rating}>
                  {accommodation.reviewRatingLabel}
                </span>
                <span className={styles.reviewCount}>
                  {accommodation.reviewCountLabel}
                </span>
              </div>
            )}
          </div>
          <div className={styles.name}>{accommodation.name}</div>
          <div className={styles.price}>
            <span className={styles.priceAmount}>
              {priceDisplay.amountLabel}
            </span>
            <span className={styles.priceUnit}> {priceDisplay.unitLabel}</span>
          </div>
        </div>
      </a>
      {onWishlistToggle && (
        <button
          type="button"
          className={`${styles.wishlistButton} ${
            accommodation.isInWishlist ? styles.active : ""
          }`}
          aria-label={
            accommodation.isInWishlist
              ? "위시리스트에서 제거"
              : "위시리스트에 저장"
          }
          aria-pressed={accommodation.isInWishlist}
          onClick={handleWishlistClick}
        >
          <svg
            viewBox="0 0 24 24"
            className={styles.wishlistIcon}
            strokeWidth="1.5"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      )}
    </div>
  );
};
