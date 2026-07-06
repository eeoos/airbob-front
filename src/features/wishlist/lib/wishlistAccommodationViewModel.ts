import type { RecentlyViewedAccommodationInfo } from "../../../types/recentlyViewed";
import type {
  WishlistAccommodationInfo,
  WishlistInfo,
} from "../../../types/wishlist";
import { getImageUrl } from "../../../utils/image";
import { formatRecentlyViewedDate } from "./recentlyViewedGroups";

export interface WishlistAccommodationCardViewModel {
  wishlistAccommodationId: number;
  accommodationId: number;
  name: string;
  thumbnailUrl: string | null;
  locationLabel: string;
  showReview: boolean;
  reviewRatingLabel: string;
  reviewCountLabel: string;
  memo: string | null;
}

export interface WishlistAccommodationMemoTarget {
  wishlistAccommodationId: number;
  memo: string | null;
}

export interface WishlistIndexCardViewModel {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  itemCountLabel: string;
}

export interface WishlistModalItemViewModel {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  itemCountLabel: string;
  isContained: boolean;
  wishlistAccommodationId: number | null;
}

export interface RecentlyViewedAccommodationCardViewModel {
  accommodationId: number;
  name: string;
  thumbnailUrl: string | null;
  locationLabel: string;
  showReview: boolean;
  reviewRatingLabel: string;
  reviewCountLabel: string;
  isInWishlist: boolean;
  viewedAt: string;
}

export const toWishlistAccommodationMemoTarget = (
  accommodation: Pick<
    WishlistAccommodationCardViewModel,
    "wishlistAccommodationId" | "memo"
  >,
): WishlistAccommodationMemoTarget => ({
  wishlistAccommodationId: accommodation.wishlistAccommodationId,
  memo: accommodation.memo,
});

export const toWishlistAccommodationCardViewModel = (
  item: WishlistAccommodationInfo,
): WishlistAccommodationCardViewModel => ({
  wishlistAccommodationId: item.wishlist_accommodation_id,
  accommodationId: item.accommodation.id,
  name: item.accommodation.name,
  thumbnailUrl: item.accommodation.thumbnail_url
    ? getImageUrl(item.accommodation.thumbnail_url)
    : null,
  locationLabel:
    [item.address_summary.city, item.address_summary.district]
      .filter(Boolean)
      .join(", ") || item.address_summary.country,
  showReview: item.review_summary.total_count > 0,
  reviewRatingLabel: item.review_summary.average_rating.toFixed(1),
  reviewCountLabel: `(${item.review_summary.total_count})`,
  memo: item.memo,
});

export const toWishlistIndexCardViewModel = (
  wishlist: WishlistInfo,
): WishlistIndexCardViewModel => ({
  id: wishlist.id,
  name: wishlist.name,
  thumbnailUrl: wishlist.thumbnail_image_url
    ? getImageUrl(wishlist.thumbnail_image_url)
    : null,
  itemCountLabel: `저장된 항목 ${wishlist.wishlist_item_count}개`,
});

export const toWishlistModalItemViewModel = (
  wishlist: WishlistInfo,
): WishlistModalItemViewModel => ({
  id: wishlist.id,
  name: wishlist.name,
  thumbnailUrl: wishlist.thumbnail_image_url
    ? getImageUrl(wishlist.thumbnail_image_url)
    : null,
  itemCountLabel: `저장된 항목 ${wishlist.wishlist_item_count}개`,
  isContained: Boolean(wishlist.is_contained),
  wishlistAccommodationId: wishlist.wishlist_accommodation_id,
});

export const toRecentlyViewedAccommodationCardViewModel = (
  item: RecentlyViewedAccommodationInfo,
): RecentlyViewedAccommodationCardViewModel => ({
  accommodationId: item.accommodation_id,
  name: item.accommodation_name,
  thumbnailUrl: item.thumbnail_url ? getImageUrl(item.thumbnail_url) : null,
  locationLabel:
    [item.address_summary?.city, item.address_summary?.district]
      .filter(Boolean)
      .join(", ") ||
    item.address_summary?.country ||
    "",
  showReview: Boolean(
    item.review_summary && item.review_summary.total_count > 0,
  ),
  reviewRatingLabel: (item.review_summary?.average_rating ?? 0).toFixed(1),
  reviewCountLabel: `(${item.review_summary?.total_count ?? 0})`,
  isInWishlist: item.is_in_wishlist,
  viewedAt: item.viewed_at,
});

export const getRecentlyViewedSummaryLabel = (
  items: RecentlyViewedAccommodationCardViewModel[],
) =>
  items.length > 0 ? formatRecentlyViewedDate(items[0].viewedAt) : "항목 없음";
