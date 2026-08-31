import type {
  AddressSummary,
  CursorPageInfo,
  ReviewSummary,
  WishlistCollection,
  WishlistDetail,
} from "../model/wishlist";
import type { RecentlyViewedCollection } from "../model/recentlyViewed";
import type {
  AddressSummaryWire,
  CursorPageInfoWire,
  RecentlyViewedCollectionWire,
  ReviewSummaryWire,
  WishlistCollectionWire,
  WishlistDetailWire,
} from "./contracts";

const toCursorPageInfo = (wire: CursorPageInfoWire): CursorPageInfo => ({
  hasNext: wire.has_next,
  nextCursor: wire.next_cursor,
  currentSize: wire.current_size,
});

const toAddressSummary = (wire: AddressSummaryWire): AddressSummary => ({
  country: wire.country,
  state: wire.state,
  city: wire.city,
  district: wire.district,
});

const toReviewSummary = (wire: ReviewSummaryWire): ReviewSummary => ({
  totalCount: wire.total_count,
  averageRating: wire.average_rating,
});

export const toWishlistCollection = (
  wire: WishlistCollectionWire,
): WishlistCollection => ({
  wishlists: wire.wishlists.map((wishlist) => ({
    id: wishlist.id,
    name: wishlist.name,
    createdAt: wishlist.created_at,
    itemCount: wishlist.wishlist_item_count,
    thumbnailImageUrl: wishlist.thumbnail_image_url,
    containsAccommodation: wishlist.is_contained,
    wishlistAccommodationId: wishlist.wishlist_accommodation_id,
  })),
  pageInfo: toCursorPageInfo(wire.page_info),
});

export const toWishlistDetail = (wire: WishlistDetailWire): WishlistDetail => ({
  accommodations: wire.wishlist_accommodations.map((item) => ({
    wishlistAccommodationId: item.wishlist_accommodation_id,
    memo: item.memo,
    createdAt: item.created_at,
    accommodation: {
      id: item.accommodation.id,
      name: item.accommodation.name,
      thumbnailUrl: item.accommodation.thumbnail_url,
    },
    addressSummary: toAddressSummary(item.address_summary),
    reviewSummary: toReviewSummary(item.review_summary),
    isInWishlist: item.is_in_wishlist,
  })),
  pageInfo: toCursorPageInfo(wire.page_info),
});

export const toRecentlyViewedCollection = (
  wire: RecentlyViewedCollectionWire,
): RecentlyViewedCollection => ({
  accommodations: wire.accommodations.map((item) => ({
    viewedAt: item.viewed_at,
    accommodationId: item.accommodation_id,
    accommodationName: item.accommodation_name,
    thumbnailUrl: item.thumbnail_url,
    addressSummary: item.address_summary
      ? toAddressSummary(item.address_summary)
      : null,
    reviewSummary: item.review_summary
      ? toReviewSummary(item.review_summary)
      : null,
    isInWishlist: item.is_in_wishlist,
  })),
  totalCount: wire.total_count,
});
