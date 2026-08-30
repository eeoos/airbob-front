import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import type { SearchAccommodation } from "../model/search";

const ACCOMMODATION_TYPE_LABELS: Readonly<Record<string, string>> = {
  ENTIRE_PLACE: "전체 숙소",
  PRIVATE_ROOM: "개인실",
  SHARED_ROOM: "다인실",
  HOTEL_ROOM: "호텔 객실",
  HOSTEL: "호스텔",
  VILLA: "빌라",
  GUESTHOUSE: "게스트하우스",
  BNB: "B&B",
  RESORT: "리조트",
  APARTMENT: "아파트",
  HOUSE: "일반 주택",
  TENT: "텐트",
  BOAT: "보트",
  TREEHOUSE: "트리하우스",
  CAMPER_VAN: "캠핑카",
  CASTLE: "성 같은 특이한 숙소",
};

const getAccommodationTypeLabel = (type: string) =>
  ACCOMMODATION_TYPE_LABELS[type] ?? type;

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
  accommodation: SearchAccommodation,
): SearchAccommodationCardViewModel => ({
  id: accommodation.id,
  name: accommodation.name,
  thumbnailUrl: accommodation.thumbnailUrl
    ? resolveImageUrl(accommodation.thumbnailUrl)
    : null,
  locationLabel: `${
    accommodation.addressSummary.city || accommodation.addressSummary.country
  }의 ${getAccommodationTypeLabel(accommodation.type)}`,
  showReview: accommodation.reviewSummary.totalCount > 0,
  reviewRatingLabel: accommodation.reviewSummary.averageRating.toFixed(1),
  reviewCountLabel: `(${accommodation.reviewSummary.totalCount})`,
  basePrice: accommodation.basePrice,
  currency: accommodation.currency,
  isInWishlist: accommodation.isInWishlist,
});

export const toSearchAccommodationMapViewModel = (
  accommodation: SearchAccommodation,
): SearchAccommodationMapViewModel => ({
  id: accommodation.id,
  name: accommodation.name,
  thumbnailUrl: accommodation.thumbnailUrl
    ? resolveImageUrl(accommodation.thumbnailUrl)
    : null,
  locationLabel:
    [accommodation.addressSummary.city, accommodation.addressSummary.district]
      .filter(Boolean)
      .join(", ") || accommodation.addressSummary.country,
  showReview: accommodation.reviewSummary.totalCount > 0,
  reviewRatingLabel: accommodation.reviewSummary.averageRating.toFixed(1),
  reviewCountLabel: `(${accommodation.reviewSummary.totalCount})`,
  basePrice: accommodation.basePrice,
  currency: accommodation.currency,
  isInWishlist: accommodation.isInWishlist,
  coordinate: {
    latitude: accommodation.coordinate.latitude,
    longitude: accommodation.coordinate.longitude,
  },
});
