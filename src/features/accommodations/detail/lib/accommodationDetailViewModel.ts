import type { AccommodationDetail } from "../model/accommodationDetail";
import { getAccommodationTypeLabel } from "./accommodationLabels";

interface AccommodationAmenitySemanticResolver {
  resolve(code: string): {
    readonly isKnown: boolean;
    readonly label: string;
  };
}

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
    isKnown: boolean;
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

const getAvatarInitial = (name: string) => name.trim().charAt(0).toUpperCase();

const getLocationLabel = (accommodation: AccommodationDetail) =>
  [accommodation.addressSummary.city, accommodation.addressSummary.country]
    .filter(Boolean)
    .join(", ");

export const toAccommodationDetailViewModel = (
  accommodation: AccommodationDetail,
  imageResolver: (path: string | null) => string,
  amenityResolver: AccommodationAmenitySemanticResolver,
): AccommodationDetailViewModel => {
  const typeLabel = getAccommodationTypeLabel(accommodation.type);
  const locationName =
    accommodation.addressSummary.city || accommodation.addressSummary.country;
  const heroImages = accommodation.images.map((image, index) => ({
    id: image.id,
    url: imageResolver(image.imageUrl),
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
      avatarUrl: imageResolver(accommodation.host.thumbnailImageUrl),
      avatarInitial: getAvatarInitial(accommodation.host.nickname),
    },
    counts: {
      guests: accommodation.policy.maxOccupancy,
      bedrooms: null,
      beds: null,
      baths: null,
      infants: accommodation.policy.infantOccupancy,
      pets: accommodation.policy.petOccupancy,
      guestLabel: `최대 인원 ${accommodation.policy.maxOccupancy}명`,
    },
    rating: {
      averageRating: accommodation.reviewSummary.averageRating,
      reviewCount: accommodation.reviewSummary.totalCount,
      hasReviews: accommodation.reviewSummary.totalCount > 0,
      averageRatingLabel: accommodation.reviewSummary.averageRating.toFixed(1),
      reviewCountLabel: `(${accommodation.reviewSummary.totalCount})`,
    },
    amenities: accommodation.amenities.map((amenity, index) => {
      const semanticAmenity = amenityResolver.resolve(amenity.type);

      return {
        key: `${amenity.type}-${index}`,
        type: amenity.type,
        label: semanticAmenity.label,
        isKnown: semanticAmenity.isKnown,
        count: amenity.count,
      };
    }),
    labels: {
      cancellation: "취소 정책",
      checkIn: `체크인 ${formatTimeLabel(accommodation.checkInTime)}`,
      checkOut: `체크아웃 ${formatTimeLabel(accommodation.checkOutTime)}`,
    },
    isInWishlist: accommodation.isInWishlist,
    coordinate: accommodation.coordinate,
  };
};
