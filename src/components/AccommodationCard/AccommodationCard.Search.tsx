import React from "react";
import { useNavigate } from "react-router-dom";
import { AccommodationSearchInfo } from "../../types/accommodation";
import { PriceResponse } from "../../types/accommodation";
import { getImageUrl } from "../../utils/image";
import styles from "./AccommodationCard.Search.module.css";

interface AccommodationCardSearchProps {
  accommodation: AccommodationSearchInfo;
  onWishlistToggle?: () => void;
  onClick?: () => void;
  checkIn?: string | null;
  checkOut?: string | null;
}

export const AccommodationCardSearch: React.FC<AccommodationCardSearchProps> = ({
  accommodation,
  onWishlistToggle,
  onClick,
  checkIn,
  checkOut,
}) => {
  const navigate = useNavigate();

  const formatPrice = (price: PriceResponse): string => {
    return price.price;
  };

  // 날짜 차이 계산 (박수)
  const calculateNights = (checkIn: string | null | undefined, checkOut: string | null | undefined): number => {
    if (!checkIn || !checkOut) return 1;
    
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const diffTime = checkOutDate.getTime() - checkInDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 1;
  };

  // 가격에서 숫자만 추출
  const extractPriceNumber = (priceString: string): number => {
    // "₩5,000" 형식에서 숫자만 추출
    const numberString = priceString.replace(/[^\d]/g, '');
    return parseInt(numberString, 10) || 0;
  };

  // 총 가격 계산 및 포맷팅
  const formatTotalPrice = (pricePerNight: PriceResponse, nights: number): string => {
    const priceNumber = extractPriceNumber(pricePerNight.price);
    const totalPrice = priceNumber * nights;
    
    // 천 단위 구분자 추가
    return `₩${totalPrice.toLocaleString()}`;
  };

  const nights = calculateNights(checkIn, checkOut);
  const hasDates = checkIn && checkOut;

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/accommodations/${accommodation.id}`);
    }
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onWishlistToggle) {
      onWishlistToggle();
    }
  };

  return (
    <div className={styles.accommodationCard} onClick={handleCardClick}>
      <div className={styles.wishlistCardImage}>
        {accommodation.accommodation_thumbnail_url ? (
          <img
            src={getImageUrl(accommodation.accommodation_thumbnail_url)}
            alt={accommodation.name}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder-image.png";
            }}
          />
        ) : (
          <div className={styles.placeholderImage}>이미지 없음</div>
        )}
        {onWishlistToggle && (
          <button
            className={`${styles.wishlistButton} ${
              accommodation.is_in_wishlist ? styles.active : ""
            }`}
            onClick={handleWishlistClick}
          >
            <svg
              viewBox="0 0 24 24"
              fill={accommodation.is_in_wishlist ? "#ff385c" : "none"}
              stroke={accommodation.is_in_wishlist ? "#ffffff" : "#222222"}
              strokeWidth="1.5"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        )}
      </div>
      <div className={styles.wishlistCardInfo}>
        <div className={styles.locationRow}>
          <div className={styles.location}>{accommodation.location_summary}</div>
          {accommodation.review.total_count > 0 && (
            <div className={styles.review}>
              <span className={styles.star}>★</span>
              <span className={styles.rating}>{accommodation.review.average_rating.toFixed(1)}</span>
              <span className={styles.reviewCount}>({accommodation.review.total_count})</span>
            </div>
          )}
        </div>
        <div className={styles.name}>{accommodation.name}</div>
        <div className={styles.price}>
          <span className={styles.priceAmount}>
            {hasDates 
              ? formatTotalPrice(accommodation.price_per_night, nights)
              : formatPrice(accommodation.price_per_night)}
          </span>
          {hasDates && <span className={styles.priceUnit}> {nights}박</span>}
          {!hasDates && <span className={styles.priceUnit}> 1박</span>}
        </div>
      </div>
    </div>
  );
};


