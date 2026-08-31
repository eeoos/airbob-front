export interface CursorPageInfo {
  readonly hasNext: boolean;
  readonly nextCursor: string | null;
  readonly currentSize: number;
}

export interface AddressSummary {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
}

export interface ReviewSummary {
  readonly totalCount: number;
  readonly averageRating: number;
}

interface AccommodationSummary {
  readonly id: number;
  readonly name: string;
  readonly thumbnailUrl: string | null;
}

export interface WishlistSummary {
  readonly id: number;
  readonly name: string;
  readonly createdAt: string;
  readonly itemCount: number;
  readonly thumbnailImageUrl: string | null;
  readonly containsAccommodation: boolean | null;
  readonly wishlistAccommodationId: number | null;
}

export interface WishlistCollection {
  readonly wishlists: readonly WishlistSummary[];
  readonly pageInfo: CursorPageInfo;
}

export interface WishlistAccommodation {
  readonly wishlistAccommodationId: number;
  readonly memo: string | null;
  readonly createdAt: string;
  readonly accommodation: AccommodationSummary;
  readonly addressSummary: AddressSummary;
  readonly reviewSummary: ReviewSummary;
  readonly isInWishlist: boolean;
}

export interface WishlistDetail {
  readonly accommodations: readonly WishlistAccommodation[];
  readonly pageInfo: CursorPageInfo;
}

export interface IdentifierResult {
  readonly id: number;
}

export interface CreateWishlistInput {
  readonly name: string;
}

export interface AddWishlistAccommodationInput {
  readonly accommodationId: number;
}

export interface UpdateWishlistAccommodationMemoInput {
  readonly memo: string;
}

export interface WishlistListParams {
  readonly accommodationId?: number;
  readonly cursor?: string;
  readonly size?: number;
}

export interface WishlistDetailParams {
  readonly cursor?: string;
  readonly size?: number;
}

export interface ApiRequestOptions {
  readonly signal?: AbortSignal;
}
