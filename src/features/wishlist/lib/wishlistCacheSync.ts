import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { RecentlyViewedAccommodationInfos } from "../../../types/recentlyViewed";
import {
  WishlistAccommodationInfos,
  WishlistInfos,
} from "../../../types/wishlist";
import { searchQueryKeys } from "../../search/queryKeys";
import { wishlistQueryKeys } from "../queryKeys";
import type { WishlistMembershipResult } from "./wishlistMembership";
import { getWishlistListsParamsSignature } from "./wishlistListQueryParams";

export type WishlistListsInfiniteData = InfiniteData<
  WishlistInfos,
  string | null
>;
export type WishlistDetailInfiniteData = InfiniteData<
  WishlistAccommodationInfos,
  string | null
>;

export const wishlistListsQueryPrefix = [
  ...wishlistQueryKeys.all,
  "lists",
] as const;
export const wishlistDetailQueryPrefix = [
  ...wishlistQueryKeys.all,
  "detail",
] as const;
export const getWishlistDetailQueryPrefix = (wishlistId: number) =>
  [...wishlistQueryKeys.all, "detail", wishlistId] as const;

export const removeWishlistFromPages = (
  data: WishlistListsInfiniteData | undefined,
  wishlistId: number,
) =>
  data
    ? {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          wishlists: page.wishlists.filter(
            (wishlist) => wishlist.id !== wishlistId,
          ),
        })),
      }
    : data;

export const removeAccommodationFromPages = (
  data: WishlistDetailInfiniteData | undefined,
  wishlistAccommodationId: number,
) =>
  data
    ? {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          wishlist_accommodations: page.wishlist_accommodations.filter(
            (item) =>
              item.wishlist_accommodation_id !== wishlistAccommodationId,
          ),
        })),
      }
    : data;

export const updateAccommodationMemoInPages = (
  data: WishlistDetailInfiniteData | undefined,
  wishlistAccommodationId: number,
  memo: string,
) =>
  data
    ? {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          wishlist_accommodations: page.wishlist_accommodations.map((item) =>
            item.wishlist_accommodation_id === wishlistAccommodationId
              ? { ...item, memo }
              : item,
          ),
        })),
      }
    : data;

export const removeRecentlyViewedAccommodation = (
  data: RecentlyViewedAccommodationInfos | undefined,
  accommodationId: number,
) => {
  if (!data) return data;

  const accommodations = data.accommodations.filter(
    (item) => item.accommodation_id !== accommodationId,
  );

  return {
    ...data,
    accommodations,
    total_count:
      accommodations.length === data.accommodations.length
        ? data.total_count
        : Math.max(0, data.total_count - 1),
  };
};

export const updateRecentlyViewedWishlistState = (
  data: RecentlyViewedAccommodationInfos | undefined,
  accommodationId: number,
  getNextValue: (currentValue: boolean) => boolean,
) =>
  data
    ? {
        ...data,
        accommodations: data.accommodations.map((item) =>
          item.accommodation_id === accommodationId
            ? {
                ...item,
                is_in_wishlist: getNextValue(item.is_in_wishlist),
              }
            : item,
        ),
      }
    : data;

export const setAccommodationScopedWishlistMembershipCache = (
  queryClient: QueryClient,
  accommodationId: number,
  membership: Pick<WishlistMembershipResult, "pageParams" | "pages">,
) => {
  queryClient.setQueryData<WishlistListsInfiniteData>(
    wishlistQueryKeys.lists(
      getWishlistListsParamsSignature({ accommodationId }),
    ),
    {
      pageParams: membership.pageParams,
      pages: membership.pages,
    },
  );
};

export const removeRecentlyViewedAccommodationFromCache = (
  queryClient: QueryClient,
  accommodationId: number,
) => {
  queryClient.setQueryData<RecentlyViewedAccommodationInfos>(
    wishlistQueryKeys.recentlyViewed(),
    (prev: RecentlyViewedAccommodationInfos | undefined) =>
      removeRecentlyViewedAccommodation(prev, accommodationId),
  );
};

export const removeWishlistFromCache = (
  queryClient: QueryClient,
  wishlistId: number,
) => {
  queryClient.setQueriesData<WishlistListsInfiniteData>(
    { queryKey: wishlistListsQueryPrefix },
    (prev: WishlistListsInfiniteData | undefined) =>
      removeWishlistFromPages(prev, wishlistId),
  );
  queryClient.removeQueries({
    queryKey: getWishlistDetailQueryPrefix(wishlistId),
  });
};

export const removeWishlistAccommodationFromCache = (
  queryClient: QueryClient,
  wishlistAccommodationId: number,
) => {
  queryClient.setQueriesData<WishlistDetailInfiniteData>(
    { queryKey: wishlistDetailQueryPrefix },
    (prev: WishlistDetailInfiniteData | undefined) =>
      removeAccommodationFromPages(prev, wishlistAccommodationId),
  );
};

export const updateWishlistAccommodationMemoInCache = (
  queryClient: QueryClient,
  wishlistAccommodationId: number,
  memo: string,
) => {
  queryClient.setQueriesData<WishlistDetailInfiniteData>(
    { queryKey: wishlistDetailQueryPrefix },
    (prev: WishlistDetailInfiniteData | undefined) =>
      updateAccommodationMemoInPages(prev, wishlistAccommodationId, memo),
  );
};

export const updateRecentlyViewedWishlistStateInCache = (
  queryClient: QueryClient,
  accommodationId: number,
  getNextValue: (currentValue: boolean) => boolean,
) => {
  queryClient.setQueryData<RecentlyViewedAccommodationInfos>(
    wishlistQueryKeys.recentlyViewed(),
    (prev: RecentlyViewedAccommodationInfos | undefined) =>
      updateRecentlyViewedWishlistState(
        prev,
        accommodationId,
        getNextValue,
      ),
  );
};

export const invalidateWishlistCollectionCaches = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: wishlistListsQueryPrefix });
  queryClient.invalidateQueries({
    queryKey: wishlistQueryKeys.recentlyViewed(),
  });
  queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
};

export const invalidateWishlistMutationCaches = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: wishlistQueryKeys.all });
  queryClient.invalidateQueries({
    queryKey: wishlistQueryKeys.recentlyViewed(),
  });
  queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
};
