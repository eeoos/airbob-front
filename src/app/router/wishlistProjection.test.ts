import { QueryClient } from "@tanstack/react-query";
import type { AccommodationDetail } from "../../features/accommodations/detail/model/accommodationDetail";
import { accommodationReadQueryKeys } from "../../features/accommodations/detail/queries/queryKeys";
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

const accommodationDetail = (
  id: number,
  isInWishlist: boolean,
): AccommodationDetail => ({
  id,
  name: `stay-${id}`,
  description: "description",
  type: "HOUSE",
  basePrice: 120000,
  currency: "KRW",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  unavailableDates: [],
  isInWishlist,
  addressSummary: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: null,
  },
  coordinate: { latitude: 37.5, longitude: 127.0 },
  host: { id: 9, nickname: "host", thumbnailImageUrl: null },
  policy: { maxOccupancy: 4, infantOccupancy: 1, petOccupancy: 0 },
  amenities: [],
  images: [],
  reviewSummary: { totalCount: 0, averageRating: 0 },
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
  it("updates wishlist, search, and detail caches for only the active scope", () => {
    const client = new QueryClient();
    const searchKeyA = searchReadQueryKeys.results(scopeA, request);
    const searchKeyB = searchReadQueryKeys.results(scopeB, request);
    const detailKeyA = accommodationReadQueryKeys.detail(scopeA, 7);
    const detailKeyB = accommodationReadQueryKeys.detail(scopeB, 7);
    const recentKey = wishlistReadQueryKeys.recentlyViewed(scopeA);

    seedScoped(client, searchKeyA, scopeA, searchPage(false));
    seedScoped(client, searchKeyB, scopeB, searchPage(false));
    seedScoped(client, detailKeyA, scopeA, accommodationDetail(7, false));
    seedScoped(client, detailKeyB, scopeB, accommodationDetail(7, false));
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
    expect(
      client.getQueryData<AccommodationDetail>(detailKeyA)?.isInWishlist,
    ).toBe(true);
    expect(
      client.getQueryData<AccommodationDetail>(detailKeyB)?.isInWishlist,
    ).toBe(false);
  });

  it("invalidates search and every detail only in the deleted wishlist scope", () => {
    const client = new QueryClient();
    const searchKeyA = searchReadQueryKeys.results(scopeA, request);
    const searchKeyB = searchReadQueryKeys.results(scopeB, request);
    const detailKeyA7 = accommodationReadQueryKeys.detail(scopeA, 7);
    const detailKeyA8 = accommodationReadQueryKeys.detail(scopeA, 8);
    const detailKeyB7 = accommodationReadQueryKeys.detail(scopeB, 7);
    seedScoped(client, searchKeyA, scopeA, searchPage(true));
    seedScoped(client, searchKeyB, scopeB, searchPage(true));
    seedScoped(client, detailKeyA7, scopeA, accommodationDetail(7, true));
    seedScoped(client, detailKeyA8, scopeA, accommodationDetail(8, true));
    seedScoped(client, detailKeyB7, scopeB, accommodationDetail(7, true));

    createAppWishlistProjection(client).wishlistDeleted({
      scope: scopeA,
      wishlistId: 11,
    });

    expect(client.getQueryState(searchKeyA)?.isInvalidated).toBe(true);
    expect(client.getQueryState(searchKeyB)?.isInvalidated).toBe(false);
    expect(client.getQueryState(detailKeyA7)?.isInvalidated).toBe(true);
    expect(client.getQueryState(detailKeyA8)?.isInvalidated).toBe(true);
    expect(client.getQueryState(detailKeyB7)?.isInvalidated).toBe(false);
  });
});
