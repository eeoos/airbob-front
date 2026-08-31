interface AccommodationDetailAddressSummary {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
}

interface AccommodationDetailCoordinate {
  readonly latitude: number | null;
  readonly longitude: number | null;
}

interface AccommodationDetailHost {
  readonly id: number;
  readonly nickname: string;
  readonly thumbnailImageUrl: string | null;
}

interface AccommodationDetailPolicy {
  readonly maxOccupancy: number;
  readonly infantOccupancy: number;
  readonly petOccupancy: number;
}

interface AccommodationDetailAmenity {
  readonly type: string;
  readonly count: number;
}

interface AccommodationDetailImage {
  readonly id: number;
  readonly imageUrl: string;
}

interface AccommodationDetailReviewSummary {
  readonly totalCount: number;
  readonly averageRating: number;
}

export interface AccommodationDetail {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly type: string;
  readonly basePrice: number;
  readonly currency: string;
  readonly checkInTime: string;
  readonly checkOutTime: string;
  readonly timeZoneId: string;
  readonly isInWishlist: boolean;
  readonly addressSummary: AccommodationDetailAddressSummary;
  readonly coordinate: AccommodationDetailCoordinate;
  readonly host: AccommodationDetailHost;
  readonly policy: AccommodationDetailPolicy;
  readonly amenities: readonly AccommodationDetailAmenity[];
  readonly images: readonly AccommodationDetailImage[];
  readonly reviewSummary: AccommodationDetailReviewSummary;
}

export interface AccommodationApiRequestOptions {
  readonly signal?: AbortSignal;
}
