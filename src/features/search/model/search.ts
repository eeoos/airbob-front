interface SearchAddressSummary {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
}

interface SearchCoordinate {
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface SearchViewport {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
}

export interface SearchPlaceSelection {
  readonly lat: number;
  readonly lng: number;
  readonly viewport: SearchViewport;
}

export interface SearchPlacePrediction {
  readonly placeId: string;
  readonly description: string;
  readonly mainText: string;
  readonly secondaryText: string;
}

export interface SearchSelectedPlace extends SearchPlaceSelection {
  readonly placeId: string;
}

interface SearchReviewSummary {
  readonly totalCount: number;
  readonly averageRating: number;
}

export interface SearchAccommodation {
  readonly id: number;
  readonly name: string;
  readonly thumbnailUrl: string | null;
  readonly basePrice: number;
  readonly currency: string;
  readonly type: string;
  readonly addressSummary: SearchAddressSummary;
  readonly coordinate: SearchCoordinate;
  readonly reviewSummary: SearchReviewSummary;
  readonly isInWishlist: boolean;
}

interface SearchPageInfo {
  readonly pageSize: number;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly totalElements: number;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

export interface SearchResultPage {
  readonly accommodations: readonly SearchAccommodation[];
  readonly pageInfo: SearchPageInfo;
}

/**
 * Exact query parameter contract currently accepted by the search endpoint.
 * These names intentionally remain camelCase even though the response wire
 * representation is snake_case.
 */
export interface SearchRequest {
  readonly destination?: string;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly checkIn?: string;
  readonly checkOut?: string;
  readonly adultOccupancy?: number;
  readonly childOccupancy?: number;
  readonly infantOccupancy?: number;
  readonly petOccupancy?: number;
  readonly amenityTypes?: readonly string[];
  readonly accommodationTypes?: readonly string[];
  readonly topLeftLat?: number;
  readonly topLeftLng?: number;
  readonly bottomRightLat?: number;
  readonly bottomRightLng?: number;
  readonly page?: number;
  readonly size?: number;
}

export interface SearchCommittedRouteState {
  readonly destination?: string;
  readonly page: number;
  readonly topLeftLat?: number;
  readonly topLeftLng?: number;
  readonly bottomRightLat?: number;
  readonly bottomRightLng?: number;
  readonly checkIn?: string;
  readonly checkOut?: string;
  readonly adultOccupancy: number;
  readonly childOccupancy: number;
  readonly infantOccupancy: number;
  readonly petOccupancy: number;
}

export interface SearchApiRequestOptions {
  readonly signal?: AbortSignal;
}
