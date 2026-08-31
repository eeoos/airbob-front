import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { createSessionQueryMeta } from "../../../platform/query/sessionScope";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import type {
  RecentlyViewedCollection,
  WishlistCollection,
  WishlistDetail,
} from "../model";
import { wishlistReadQueryKeys } from "../queries";
import { createWishlistQueryCacheProjection } from "./queryCacheProjection";

const scopeA: AuthenticatedSessionScope = {
  subject: "subject:member_a" as SessionSubject,
  epoch: 3,
};
const scopeB: AuthenticatedSessionScope = {
  subject: "subject:member_b" as SessionSubject,
  epoch: 4,
};

const seedScopedQueryData = <TData,>(
  client: QueryClient,
  queryKey: readonly unknown[],
  scope: AuthenticatedSessionScope,
  data: TData,
) => {
  client.setQueryDefaults(queryKey, { meta: createSessionQueryMeta(scope) });
  client.setQueryData(queryKey, data);
};

const collection = (id: number): InfiniteData<WishlistCollection, string | null> => ({
  pageParams: [null],
  pages: [{
    wishlists: [{
      id,
      name: `list ${id}`,
      createdAt: "2026-08-29T00:00:00Z",
      itemCount: 1,
      thumbnailImageUrl: null,
      containsAccommodation: null,
      wishlistAccommodationId: null,
    }],
    pageInfo: { hasNext: false, nextCursor: null, currentSize: 1 },
  }],
});

const recentlyViewed = (isInWishlist: boolean): RecentlyViewedCollection => ({
  totalCount: 1,
  accommodations: [{
    accommodationId: 7,
    accommodationName: "stay",
    viewedAt: "2026-08-29T00:00:00Z",
    thumbnailUrl: null,
    addressSummary: null,
    reviewSummary: null,
    isInWishlist,
  }],
});

const detail = (memo: string): InfiniteData<WishlistDetail, string | null> => ({
  pageParams: [null],
  pages: [{
    accommodations: [{
      wishlistAccommodationId: 31,
      memo,
      createdAt: "2026-08-29T00:00:00Z",
      accommodation: { id: 7, name: "stay", thumbnailUrl: null },
      addressSummary: { country: "KR", state: null, city: "Seoul", district: null },
      reviewSummary: { totalCount: 0, averageRating: 0 },
      isInWishlist: true,
    }],
    pageInfo: { hasNext: false, nextCursor: null, currentSize: 1 },
  }],
});

describe("wishlist query cache projection", () => {
  it("updates only the explicitly scoped viewer cache", () => {
    const client = new QueryClient();
    const recentA = wishlistReadQueryKeys.recentlyViewed(scopeA);
    const recentB = wishlistReadQueryKeys.recentlyViewed(scopeB);
    seedScopedQueryData(client, recentA, scopeA, recentlyViewed(false));
    seedScopedQueryData(client, recentB, scopeB, recentlyViewed(false));

    createWishlistQueryCacheProjection(client).membershipReconciled({
      scope: scopeA,
      accommodationId: 7,
      isInAnyWishlist: true,
    });

    expect(client.getQueryData<RecentlyViewedCollection>(recentA)?.accommodations).toEqual([
      expect.objectContaining({ isInWishlist: true }),
    ]);
    expect(client.getQueryData<RecentlyViewedCollection>(recentB)?.accommodations).toEqual([
      expect.objectContaining({ isInWishlist: false }),
    ]);
  });

  it("invalidates refresh-required resources only for the captured scope", () => {
    const client = new QueryClient();
    const listsA = wishlistReadQueryKeys.lists(scopeA, null);
    const recentA = wishlistReadQueryKeys.recentlyViewed(scopeA);
    const listsB = wishlistReadQueryKeys.lists(scopeB, null);
    seedScopedQueryData(client, listsA, scopeA, collection(11));
    seedScopedQueryData(client, recentA, scopeA, recentlyViewed(false));
    seedScopedQueryData(client, listsB, scopeB, collection(12));

    createWishlistQueryCacheProjection(client).membershipRefreshRequired({
      scope: scopeA,
      accommodationId: 7,
    });

    expect(client.getQueryState(listsA)?.isInvalidated).toBe(true);
    expect(client.getQueryState(recentA)?.isInvalidated).toBe(true);
    expect(client.getQueryState(listsB)?.isInvalidated).toBe(false);
  });

  it("invalidates only the captured viewer's list after creation", () => {
    const client = new QueryClient();
    const listsA = wishlistReadQueryKeys.lists(scopeA, null);
    const listsB = wishlistReadQueryKeys.lists(scopeB, null);
    seedScopedQueryData(client, listsA, scopeA, collection(11));
    seedScopedQueryData(client, listsB, scopeB, collection(12));

    createWishlistQueryCacheProjection(client).wishlistCreated({
      scope: scopeA,
      wishlistId: 13,
    });

    expect(client.getQueryState(listsA)?.isInvalidated).toBe(true);
    expect(client.getQueryState(listsB)?.isInvalidated).toBe(false);
  });

  it("removes a deleted list and its scoped detail without touching another subject", () => {
    const client = new QueryClient();
    const listsA = wishlistReadQueryKeys.lists(scopeA, null);
    const detailA = wishlistReadQueryKeys.detail(scopeA, 11);
    const listsB = wishlistReadQueryKeys.lists(scopeB, null);
    seedScopedQueryData(client, listsA, scopeA, collection(11));
    seedScopedQueryData(client, detailA, scopeA, detail("memo"));
    seedScopedQueryData(client, listsB, scopeB, collection(11));

    createWishlistQueryCacheProjection(client).wishlistDeleted({
      scope: scopeA,
      wishlistId: 11,
    });

    expect(client.getQueryData<InfiniteData<WishlistCollection>>(listsA)?.pages).toEqual([
      expect.objectContaining({ wishlists: [] }),
    ]);
    expect(client.getQueryData(detailA)).toBeUndefined();
    expect(
      client
        .getQueryData<InfiniteData<WishlistCollection>>(listsB)
        ?.pages.flatMap((page) => page.wishlists),
    ).toHaveLength(1);
  });

  it("patches empty memo and removes recently viewed data without mutation I/O", () => {
    const client = new QueryClient();
    const detailKey = wishlistReadQueryKeys.detail(scopeA, 11);
    const recentKey = wishlistReadQueryKeys.recentlyViewed(scopeA);
    seedScopedQueryData(client, detailKey, scopeA, detail("memo"));
    seedScopedQueryData(client, recentKey, scopeA, recentlyViewed(true));
    const projection = createWishlistQueryCacheProjection(client);

    projection.memoSaved({
      scope: scopeA,
      wishlistAccommodationId: 31,
      memo: "",
    });
    projection.recentlyViewedRemoved({
      scope: scopeA,
      accommodationId: 7,
    });

    expect(
      client
        .getQueryData<InfiniteData<WishlistDetail>>(detailKey)
        ?.pages.flatMap((page) => page.accommodations),
    ).toEqual([expect.objectContaining({ memo: "" })]);
    expect(client.getQueryData<RecentlyViewedCollection>(recentKey)).toEqual({
      accommodations: [],
      totalCount: 0,
    });
  });
});
