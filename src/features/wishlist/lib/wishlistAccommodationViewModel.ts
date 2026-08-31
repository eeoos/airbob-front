import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import type {
  RecentlyViewedAccommodation,
  WishlistAccommodation,
  WishlistSummary,
} from "../model";
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
  item: WishlistAccommodation,
): WishlistAccommodationCardViewModel => ({
  wishlistAccommodationId: item.wishlistAccommodationId,
  accommodationId: item.accommodation.id,
  name: item.accommodation.name,
  thumbnailUrl: item.accommodation.thumbnailUrl
    ? resolveImageUrl(item.accommodation.thumbnailUrl)
    : null,
  locationLabel:
    [item.addressSummary.city, item.addressSummary.district]
      .filter(Boolean)
      .join(", ") || item.addressSummary.country,
  showReview: item.reviewSummary.totalCount > 0,
  reviewRatingLabel: item.reviewSummary.averageRating.toFixed(1),
  reviewCountLabel: `(${item.reviewSummary.totalCount})`,
  memo: item.memo,
});

export const toWishlistIndexCardViewModel = (
  wishlist: WishlistSummary,
): WishlistIndexCardViewModel => ({
  id: wishlist.id,
  name: wishlist.name,
  thumbnailUrl: wishlist.thumbnailImageUrl
    ? resolveImageUrl(wishlist.thumbnailImageUrl)
    : null,
  itemCountLabel: `저장된 항목 ${wishlist.itemCount}개`,
});

export const toWishlistModalItemViewModel = (
  wishlist: WishlistSummary,
): WishlistModalItemViewModel => ({
  id: wishlist.id,
  name: wishlist.name,
  thumbnailUrl: wishlist.thumbnailImageUrl
    ? resolveImageUrl(wishlist.thumbnailImageUrl)
    : null,
  itemCountLabel: `저장된 항목 ${wishlist.itemCount}개`,
  isContained: wishlist.containsAccommodation === true,
  wishlistAccommodationId: wishlist.wishlistAccommodationId,
});

export const toRecentlyViewedAccommodationCardViewModel = (
  item: RecentlyViewedAccommodation,
): RecentlyViewedAccommodationCardViewModel => ({
  accommodationId: item.accommodationId,
  name: item.accommodationName,
  thumbnailUrl: item.thumbnailUrl ? resolveImageUrl(item.thumbnailUrl) : null,
  locationLabel:
    [item.addressSummary?.city, item.addressSummary?.district]
      .filter(Boolean)
      .join(", ") ||
    item.addressSummary?.country ||
    "",
  showReview: Boolean(item.reviewSummary && item.reviewSummary.totalCount > 0),
  reviewRatingLabel: (item.reviewSummary?.averageRating ?? 0).toFixed(1),
  reviewCountLabel: `(${item.reviewSummary?.totalCount ?? 0})`,
  isInWishlist: item.isInWishlist,
  viewedAt: item.viewedAt,
});

export const getRecentlyViewedSummaryLabel = (
  items: RecentlyViewedAccommodationCardViewModel[],
) => {
  const [firstItem] = items;
  return firstItem ? formatRecentlyViewedDate(firstItem.viewedAt) : "항목 없음";
};
