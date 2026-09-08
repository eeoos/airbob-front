import React from "react";
import { useResponsiveLayout } from "../../../shared/styles/useResponsiveLayout";
import { ImageWithFallback } from "../../../shared/ui";
import {
  getSearchAccommodationPriceDisplay,
  type SearchAccommodationCardViewModel,
} from "../lib/searchAccommodationViewModel";
import styles from "./SearchAccommodationCard.module.css";

interface SearchAccommodationCardProps {
  accommodation: SearchAccommodationCardViewModel;
  detailUrl: string;
  onWishlistToggle?: (() => void) | undefined;
  isWishlistPending?: boolean;
  onClick?: (() => void) | undefined;
  checkIn?: string | null | undefined;
  checkOut?: string | null | undefined;
}

export const SearchAccommodationCard: React.FC<
  SearchAccommodationCardProps
> = ({
  accommodation,
  detailUrl,
  onWishlistToggle,
  isWishlistPending = false,
  onClick,
  checkIn,
  checkOut,
}) => {
  const layout = useResponsiveLayout();
  const priceDisplay = getSearchAccommodationPriceDisplay(
    accommodation,
    checkIn,
    checkOut,
  );

  const handleCardClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      onClick &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.button === 0
    ) {
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
        target={layout === "desktop" ? "_blank" : undefined}
        rel="noopener noreferrer"
        className={styles.cardLink}
        aria-label={`숙소 상세 보기: ${accommodation.name}`}
        onClick={handleCardClick}
      >
        <div className={styles.wishlistCardImage}>
          <ImageWithFallback
            src={accommodation.thumbnailUrl}
            alt={accommodation.name}
            fallback={
              <div
                className={styles.placeholderImage}
                role="img"
                aria-label={`${accommodation.name} 이미지 없음`}
              >
                <svg
                  aria-hidden="true"
                  className={styles.placeholderIcon}
                  viewBox="0 0 48 48"
                >
                  <path d="M8 14a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V14Zm3 20 9-10 7 7 4-5 7 8m-4-17a3 3 0 1 1-6 0 3 3 0 1 1 6 0Z" />
                </svg>
                <span>사진 준비 중</span>
              </div>
            }
          />
        </div>
        <div className={styles.wishlistCardInfo}>
          <div className={styles.locationRow}>
            <div className={styles.location}>{accommodation.locationLabel}</div>
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
          aria-busy={isWishlistPending || undefined}
          disabled={isWishlistPending}
          onClick={handleWishlistClick}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            className={styles.wishlistIcon}
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      )}
    </div>
  );
};
