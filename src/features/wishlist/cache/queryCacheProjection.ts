import type {
  InfiniteData,
  QueryClient,
  QueryFilters,
} from "@tanstack/react-query";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { matchesSessionQueryScope } from "../../../platform/query/sessionScope";
import type {
  RecentlyViewedCollection,
  WishlistCollection,
  WishlistDetail,
} from "../model";
import { wishlistReadQueryKeys } from "../queries/queryKeys";
import type { WishlistProjectionPort } from "../ports/wishlistProjectionPort";

type QueryPredicate = NonNullable<QueryFilters["predicate"]>;

const scopedWishlistPredicate =
  (
    scope: AuthenticatedSessionScope,
    resource?: "lists" | "detail" | "recentlyViewed",
  ): QueryPredicate =>
  (query) =>
    query.queryKey[0] === wishlistReadQueryKeys.root[0] &&
    (resource === undefined || query.queryKey[1] === resource) &&
    matchesSessionQueryScope(query.meta, scope);

const removeWishlistFromCollection = (
  data: InfiniteData<WishlistCollection, string | null> | undefined,
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

const patchMemo = (
  data: InfiniteData<WishlistDetail, string | null> | undefined,
  wishlistAccommodationId: number,
  memo: string,
) =>
  data
    ? {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          accommodations: page.accommodations.map((item) =>
            item.wishlistAccommodationId === wishlistAccommodationId
              ? { ...item, memo }
              : item,
          ),
        })),
      }
    : data;

const patchRecentlyViewedMembership = (
  data: RecentlyViewedCollection | undefined,
  accommodationId: number,
  isInWishlist: boolean,
) =>
  data
    ? {
        ...data,
        accommodations: data.accommodations.map((item) =>
          item.accommodationId === accommodationId
            ? { ...item, isInWishlist }
            : item,
        ),
      }
    : data;

const removeRecentlyViewed = (
  data: RecentlyViewedCollection | undefined,
  accommodationId: number,
) => {
  if (!data) return data;

  const accommodations = data.accommodations.filter(
    (item) => item.accommodationId !== accommodationId,
  );
  return {
    ...data,
    accommodations,
    totalCount:
      accommodations.length === data.accommodations.length
        ? data.totalCount
        : Math.max(0, data.totalCount - 1),
  };
};

export const createWishlistQueryCacheProjection = (
  queryClient: QueryClient,
): WishlistProjectionPort => ({
  membershipReconciled({ scope, accommodationId, isInAnyWishlist }) {
    queryClient.setQueriesData<RecentlyViewedCollection>(
      { predicate: scopedWishlistPredicate(scope, "recentlyViewed") },
      (previous: RecentlyViewedCollection | undefined) =>
        patchRecentlyViewedMembership(
          previous,
          accommodationId,
          isInAnyWishlist,
        ),
    );
    void queryClient.invalidateQueries({
      predicate: (query) =>
        scopedWishlistPredicate(scope)(query) &&
        (query.queryKey[1] === "lists" || query.queryKey[1] === "detail"),
    });
  },

  membershipRefreshRequired({ scope }) {
    void queryClient.invalidateQueries({
      predicate: scopedWishlistPredicate(scope),
    });
  },

  wishlistCreated({ scope }) {
    void queryClient.invalidateQueries({
      predicate: scopedWishlistPredicate(scope, "lists"),
    });
  },

  wishlistDeleted({ scope, wishlistId }) {
    queryClient.setQueriesData<InfiniteData<WishlistCollection, string | null>>(
      { predicate: scopedWishlistPredicate(scope, "lists") },
      (previous: InfiniteData<WishlistCollection, string | null> | undefined) =>
        removeWishlistFromCollection(previous, wishlistId),
    );
    queryClient.removeQueries({
      predicate: (query) =>
        scopedWishlistPredicate(scope, "detail")(query) &&
        query.queryKey[2] === wishlistId,
    });
    void queryClient.invalidateQueries({
      predicate: (query) =>
        scopedWishlistPredicate(scope)(query) && query.queryKey[1] !== "detail",
    });
  },

  memoSaved({ scope, wishlistAccommodationId, memo }) {
    queryClient.setQueriesData<InfiniteData<WishlistDetail, string | null>>(
      { predicate: scopedWishlistPredicate(scope, "detail") },
      (previous: InfiniteData<WishlistDetail, string | null> | undefined) =>
        patchMemo(previous, wishlistAccommodationId, memo),
    );
  },

  recentlyViewedRemoved({ scope, accommodationId }) {
    queryClient.setQueriesData<RecentlyViewedCollection>(
      { predicate: scopedWishlistPredicate(scope, "recentlyViewed") },
      (previous: RecentlyViewedCollection | undefined) =>
        removeRecentlyViewed(previous, accommodationId),
    );
  },
});
