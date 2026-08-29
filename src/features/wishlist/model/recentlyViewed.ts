import type { AddressSummary, ReviewSummary } from "./wishlist";

export interface RecentlyViewedAccommodation {
  readonly viewedAt: string;
  readonly accommodationId: number;
  readonly accommodationName: string;
  readonly thumbnailUrl: string | null;
  readonly addressSummary: AddressSummary | null;
  readonly reviewSummary: ReviewSummary | null;
  readonly isInWishlist: boolean;
}

export interface RecentlyViewedCollection {
  readonly accommodations: readonly RecentlyViewedAccommodation[];
  readonly totalCount: number;
}
