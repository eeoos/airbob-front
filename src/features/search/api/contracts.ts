/**
 * The backend search endpoint currently accepts camelCase query keys. Keep
 * this wire shape explicit so a future server-side rename cannot be hidden by
 * the feature model mapper.
 */
export interface SearchWireRequest {
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

export interface SearchAddressSummaryWire {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
}

export interface SearchCoordinateWire {
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface SearchReviewSummaryWire {
  readonly total_count: number;
  readonly average_rating: number;
}

export interface SearchAccommodationWire {
  readonly id: number;
  readonly name: string;
  readonly accommodation_thumbnail_url: string | null;
  readonly base_price: number;
  readonly currency: string;
  readonly type: string;
  readonly address_summary: SearchAddressSummaryWire;
  readonly coordinate: SearchCoordinateWire;
  readonly review_summary: SearchReviewSummaryWire;
  readonly is_in_wishlist: boolean;
}

export interface SearchPageInfoWire {
  readonly page_size: number;
  readonly current_page: number;
  readonly total_pages: number;
  readonly total_elements: number;
  readonly is_first: boolean;
  readonly is_last: boolean;
  readonly has_next: boolean;
  readonly has_previous: boolean;
}

export interface SearchResultPageWire {
  readonly stay_search_result_listing: readonly SearchAccommodationWire[];
  readonly page_info: SearchPageInfoWire;
}
