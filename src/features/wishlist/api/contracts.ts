export interface CursorPageInfoWire {
  readonly has_next: boolean;
  readonly next_cursor: string | null;
  readonly current_size: number;
}

export interface AddressSummaryWire {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
}

export interface ReviewSummaryWire {
  readonly total_count: number;
  readonly average_rating: number;
}

export interface AccommodationSummaryWire {
  readonly id: number;
  readonly name: string;
  readonly thumbnail_url: string | null;
}

export interface WishlistSummaryWire {
  readonly id: number;
  readonly name: string;
  readonly created_at: string;
  readonly wishlist_item_count: number;
  readonly thumbnail_image_url: string | null;
  readonly is_contained: boolean | null;
  readonly wishlist_accommodation_id: number | null;
}

export interface WishlistCollectionWire {
  readonly wishlists: readonly WishlistSummaryWire[];
  readonly page_info: CursorPageInfoWire;
}

export interface WishlistAccommodationWire {
  readonly wishlist_accommodation_id: number;
  readonly memo: string | null;
  readonly created_at: string;
  readonly accommodation: AccommodationSummaryWire;
  readonly address_summary: AddressSummaryWire;
  readonly review_summary: ReviewSummaryWire;
  readonly is_in_wishlist: boolean;
}

export interface WishlistDetailWire {
  readonly wishlist_accommodations: readonly WishlistAccommodationWire[];
  readonly page_info: CursorPageInfoWire;
}

export interface RecentlyViewedAccommodationWire {
  readonly viewed_at: string;
  readonly accommodation_id: number;
  readonly accommodation_name: string;
  readonly thumbnail_url: string | null;
  readonly address_summary: AddressSummaryWire | null;
  readonly review_summary: ReviewSummaryWire | null;
  readonly is_in_wishlist: boolean;
}

export interface RecentlyViewedCollectionWire {
  readonly accommodations: readonly RecentlyViewedAccommodationWire[];
  readonly total_count: number;
}

export interface IdentifierWire {
  readonly id: number;
}

export interface CreateWishlistWireRequest {
  readonly name: string;
}

export interface AddWishlistAccommodationWireRequest {
  readonly accommodation_id: number;
}

export interface UpdateWishlistAccommodationMemoWireRequest {
  readonly memo: string;
}
