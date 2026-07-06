import type { AccommodationDetail } from "../../../types/accommodation";
import { getAccommodationTypeLabel, getAmenityLabel } from "../../../utils/codes";
import { getImageUrl } from "../../../utils/image";

export interface AccommodationDetailImageViewModel {
  id: number;
  url: string;
  alt: string;
}

export interface AccommodationDetailViewModel {
  id: number;
  title: string;
  description: string;
  typeLabel: string;
  locationLabel: string;
  overviewTitleLabel: string;
  heroImageUrls: string[];
  heroImages: AccommodationDetailImageViewModel[];
  hostSummary: {
    id: number;
    name: string;
    displayName: string;
    avatarUrl: string;
    avatarInitial: string;
  };
  counts: {
    guests: number;
    bedrooms: number | null;
    beds: number | null;
    baths: number | null;
    infants: number;
    pets: number;
    guestLabel: string;
  };
  rating: {
    averageRating: number;
    reviewCount: number;
    hasReviews: boolean;
    averageRatingLabel: string;
    reviewCountLabel: string;
  };
  amenities: Array<{
    key: string;
    type: string;
    label: string;
    count: number;
  }>;
  labels: {
    cancellation: string;
    checkIn: string;
    checkOut: string;
  };
  isInWishlist: boolean;
  coordinate: {
    latitude: number | null;
    longitude: number | null;
  };
}

const formatTimeLabel = (time: string) => time.split(":").slice(0, 2).join(":");

const getAvatarInitial = (name: string) =>
  name.trim().charAt(0).toUpperCase();

const getLocationLabel = (accommodation: AccommodationDetail) =>
  [accommodation.address_summary.city, accommodation.address_summary.country]
    .filter(Boolean)
    .join(", ");

export const toAccommodationDetailViewModel = (
  accommodation: AccommodationDetail,
): AccommodationDetailViewModel => {
  const typeLabel = getAccommodationTypeLabel(accommodation.type);
  const locationName =
    accommodation.address_summary.city || accommodation.address_summary.country;
  const heroImages = accommodation.images.map((image, index) => ({
    id: image.id,
    url: getImageUrl(image.image_url),
    alt: `${accommodation.name} ${index + 1}`,
  }));

  return {
    id: accommodation.id,
    title: accommodation.name,
    description: accommodation.description,
    typeLabel,
    locationLabel: getLocationLabel(accommodation),
    overviewTitleLabel: `${locationName}의 ${typeLabel}`,
    heroImageUrls: heroImages.map((image) => image.url),
    heroImages,
    hostSummary: {
      id: accommodation.host.id,
      name: accommodation.host.nickname,
      displayName: `${accommodation.host.nickname} 님`,
      avatarUrl: getImageUrl(accommodation.host.thumbnail_image_url),
      avatarInitial: getAvatarInitial(accommodation.host.nickname),
    },
    counts: {
      guests: accommodation.policy.max_occupancy,
      bedrooms: null,
      beds: null,
      baths: null,
      infants: accommodation.policy.infant_occupancy,
      pets: accommodation.policy.pet_occupancy,
      guestLabel: `최대 인원 ${accommodation.policy.max_occupancy}명`,
    },
    rating: {
      averageRating: accommodation.review_summary.average_rating,
      reviewCount: accommodation.review_summary.total_count,
      hasReviews: accommodation.review_summary.total_count > 0,
      averageRatingLabel:
        accommodation.review_summary.average_rating.toFixed(1),
      reviewCountLabel: `(${accommodation.review_summary.total_count})`,
    },
    amenities: accommodation.amenities.map((amenity, index) => ({
      key: `${amenity.type}-${index}`,
      type: amenity.type,
      label: getAmenityLabel(amenity.type),
      count: amenity.count,
    })),
    labels: {
      cancellation: "취소 정책",
      checkIn: `체크인 ${formatTimeLabel(accommodation.check_in_time)}`,
      checkOut: `체크아웃 ${formatTimeLabel(accommodation.check_out_time)}`,
    },
    isInWishlist: accommodation.is_in_wishlist,
    coordinate: {
      latitude: accommodation.coordinate.latitude,
      longitude: accommodation.coordinate.longitude,
    },
  };
};
