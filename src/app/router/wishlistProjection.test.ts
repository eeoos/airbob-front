import { QueryClient } from "@tanstack/react-query";
import type { SearchResultPage } from "../../features/search/model/search";
import { searchReadQueryKeys } from "../../features/search/queries/queryKeys";
import { wishlistReadQueryKeys } from "../../features/wishlist/queries";
import type { RecentlyViewedCollection } from "../../features/wishlist/model";
import { createSessionQueryMeta } from "../../platform/query/sessionScope";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import { createAppWishlistProjection } from "./wishlistProjection";

const scopeA: AuthenticatedSessionScope = {
  subject: "subject:member_a" as SessionSubject,
  epoch: 3,
};
const scopeB: AuthenticatedSessionScope = {
  subject: "subject:member_b" as SessionSubject,
  epoch: 4,
};

const request = { destination: "Seoul", page: 0, size: 18 } as const;

const searchPage = (isInWishlist: boolean): SearchResultPage => ({
  accommodations: [
    {
      id: 7,
      name: "서울 하우스",
      thumbnailUrl: null,
      basePrice: 100,
      currency: "KRW",
      type: "HOUSE",
      addressSummary: {
        country: "대한민국",
        state: null,
        city: "서울",
        district: null,
      },
      coordinate: { latitude: 37.5, longitude: 127 },
      reviewSummary: { totalCount: 0, averageRating: 0 },
      isInWishlist,
    },
  ],
  pageInfo: {
    pageSize: 18,
    currentPage: 0,
    totalPages: 1,
    totalElements: 1,
    isFirst: true,
    isLast: true,
    hasNext: false,
    hasPrevious: false,
  },
});

const seedScoped = <TData,>(
  client: QueryClient,
  key: readonly unknown[],
  scope: AuthenticatedSessionScope,
  data: TData,
) => {
  client.setQueryDefaults(key, { meta: createSessionQueryMeta(scope) });
  client.setQueryData(key, data);
};

describe("app router wishlist projection composition", () => {
  it("updates wishlist-owned and camelCase search caches for only the active scope", () => {
    const client = new QueryClient();
    const searchKeyA = searchReadQueryKeys.results(scopeA, request);
    const searchKeyB = searchReadQueryKeys.results(scopeB, request);
    const recentKey = wishlistReadQueryKeys.recentlyViewed(scopeA);

    seedScoped(client, searchKeyA, scopeA, searchPage(false));
    seedScoped(client, searchKeyB, scopeB, searchPage(false));
    seedScoped<RecentlyViewedCollection>(client, recentKey, scopeA, {
      totalCount: 1,
      accommodations: [
        {
          accommodationId: 7,
          accommodationName: "서울 하우스",
          viewedAt: "2026-08-29T00:00:00Z",
          thumbnailUrl: null,
          addressSummary: null,
          reviewSummary: null,
          isInWishlist: false,
        },
      ],
    });

    createAppWishlistProjection(client).membershipReconciled({
      scope: scopeA,
      accommodationId: 7,
      isInAnyWishlist: true,
    });

    expect(
      client.getQueryData<SearchResultPage>(searchKeyA)?.accommodations[0]
        .isInWishlist,
    ).toBe(true);
    expect(
      client.getQueryData<SearchResultPage>(searchKeyB)?.accommodations[0]
        .isInWishlist,
    ).toBe(false);
    expect(
      client.getQueryData<RecentlyViewedCollection>(recentKey)
        ?.accommodations[0].isInWishlist,
    ).toBe(true);
  });

  it("invalidates scoped search membership after deleting a wishlist", () => {
    const client = new QueryClient();
    const searchKeyA = searchReadQueryKeys.results(scopeA, request);
    const searchKeyB = searchReadQueryKeys.results(scopeB, request);
    seedScoped(client, searchKeyA, scopeA, searchPage(true));
    seedScoped(client, searchKeyB, scopeB, searchPage(true));

    createAppWishlistProjection(client).wishlistDeleted({
      scope: scopeA,
      wishlistId: 11,
    });

    expect(client.getQueryState(searchKeyA)?.isInvalidated).toBe(true);
    expect(client.getQueryState(searchKeyB)?.isInvalidated).toBe(false);
  });
});
