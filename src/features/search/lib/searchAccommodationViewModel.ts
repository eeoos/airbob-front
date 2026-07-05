import type { AccommodationSearchInfo } from "../../../types/accommodation";
import { getAccommodationTypeLabel } from "../../../utils/codes";
import { getImageUrl } from "../../../utils/image";

export interface SearchAccommodationCardViewModel {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  locationLabel: string;
  showReview: boolean;
  reviewRatingLabel: string;
  reviewCountLabel: string;
  basePrice: number;
  currency: string;
  isInWishlist: boolean;
}

export interface SearchAccommodationMapViewModel {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  locationLabel: string;
  showReview: boolean;
  reviewRatingLabel: string;
  reviewCountLabel: string;
  basePrice: number;
  currency: string;
  isInWishlist: boolean;
  coordinate: {
    latitude: number | null;
    longitude: number | null;
  };
}

export interface SearchAccommodationPriceDisplay {
  amountLabel: string;
  unitLabel: string;
}

export const formatAccommodationPrice = (
  basePrice: number,
  currency: string,
): string => {
  if (currency === "KRW") {
    return `₩${basePrice.toLocaleString()}`;
  }

  return `${currency} ${basePrice.toLocaleString()}`;
};

export const calculateStayNights = (
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): number => {
  if (!checkIn || !checkOut) return 1;

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const diffTime = checkOutDate.getTime() - checkInDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 1;
};

export const getSearchAccommodationPriceDisplay = (
  accommodation: Pick<SearchAccommodationCardViewModel, "basePrice" | "currency">,
  checkIn?: string | null,
  checkOut?: string | null,
): SearchAccommodationPriceDisplay => {
  const nights = calculateStayNights(checkIn, checkOut);
  const hasDates = Boolean(checkIn && checkOut);
  const basePrice = hasDates
    ? accommodation.basePrice * nights
    : accommodation.basePrice;

  return {
    amountLabel: formatAccommodationPrice(basePrice, accommodation.currency),
    unitLabel: hasDates ? `${nights}박` : "1박",
  };
};

export const toSearchAccommodationCardViewModel = (
  accommodation: AccommodationSearchInfo,
): SearchAccommodationCardViewModel => ({
  id: accommodation.id,
  name: accommodation.name,
  thumbnailUrl: accommodation.accommodation_thumbnail_url
    ? getImageUrl(accommodation.accommodation_thumbnail_url)
    : null,
  locationLabel: `${
    accommodation.address_summary.city || accommodation.address_summary.country
  }의 ${getAccommodationTypeLabel(accommodation.type)}`,
  showReview: accommodation.review_summary.total_count > 0,
  reviewRatingLabel: accommodation.review_summary.average_rating.toFixed(1),
  reviewCountLabel: `(${accommodation.review_summary.total_count})`,
  basePrice: accommodation.base_price,
  currency: accommodation.currency,
  isInWishlist: accommodation.is_in_wishlist,
});

export const toSearchAccommodationMapViewModel = (
  accommodation: AccommodationSearchInfo,
): SearchAccommodationMapViewModel => ({
  id: accommodation.id,
  name: accommodation.name,
  thumbnailUrl: accommodation.accommodation_thumbnail_url
    ? getImageUrl(accommodation.accommodation_thumbnail_url)
    : null,
  locationLabel:
    [accommodation.address_summary.city, accommodation.address_summary.district]
      .filter(Boolean)
      .join(", ") || accommodation.address_summary.country,
  showReview: accommodation.review_summary.total_count > 0,
  reviewRatingLabel: accommodation.review_summary.average_rating.toFixed(1),
  reviewCountLabel: `(${accommodation.review_summary.total_count})`,
  basePrice: accommodation.base_price,
  currency: accommodation.currency,
  isInWishlist: accommodation.is_in_wishlist,
  coordinate: {
    latitude: accommodation.coordinate.latitude,
    longitude: accommodation.coordinate.longitude,
  },
});
