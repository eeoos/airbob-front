export interface AccommodationDetailAddressSummary {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
}

export interface AccommodationDetailCoordinate {
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface AccommodationDetailHost {
  readonly id: number;
  readonly nickname: string;
  readonly thumbnailImageUrl: string | null;
}

export interface AccommodationDetailPolicy {
  readonly maxOccupancy: number;
  readonly infantOccupancy: number;
  readonly petOccupancy: number;
}

export interface AccommodationDetailAmenity {
  readonly type: string;
  readonly count: number;
}

export interface AccommodationDetailImage {
  readonly id: number;
  readonly imageUrl: string;
}

export interface AccommodationDetailReviewSummary {
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
  readonly unavailableDates: readonly string[];
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
