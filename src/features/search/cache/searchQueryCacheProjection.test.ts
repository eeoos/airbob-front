import { QueryClient } from "@tanstack/react-query";
import {
  createSessionQueryMeta,
  type SessionQueryScope,
} from "../../../platform/query/sessionScope";
import type { SessionSubject } from "../../../platform/session/sessionScope";
import type { SearchResultPage } from "../model/search";
import { searchReadQueryKeys } from "../queries/queryKeys";
import { createSearchQueryCacheProjection } from "./searchQueryCacheProjection";

const scopeA: SessionQueryScope = {
  subject: "subject:member_a" as SessionSubject,
  epoch: 3,
};
const scopeB: SessionQueryScope = {
  subject: "subject:member_b" as SessionSubject,
  epoch: 4,
};

const request = { destination: "Seoul", page: 0, size: 18 } as const;

const page = (isInWishlist: boolean): SearchResultPage => ({
  accommodations: [
    {
      id: 7,
      name: "서울 하우스",
      thumbnailUrl: null,
      basePrice: 0,
      currency: "KRW",
      type: "HOUSE",
      addressSummary: {
        country: "대한민국",
        state: null,
        city: "서울",
        district: null,
      },
      coordinate: { latitude: null, longitude: null },
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

const seedScopedQuery = (
  client: QueryClient,
  scope: SessionQueryScope,
  data: SearchResultPage,
) => {
  const key = searchReadQueryKeys.results(scope, request);
  client.setQueryDefaults(key, { meta: createSessionQueryMeta(scope) });
  client.setQueryData(key, data);
  return key;
};

describe("search query cache membership projection", () => {
  it("patches camelCase membership only for matching session metadata", () => {
    const client = new QueryClient();
    const keyA = seedScopedQuery(client, scopeA, page(false));
    const keyB = seedScopedQuery(client, scopeB, page(false));

    createSearchQueryCacheProjection(client).membershipReconciled({
      scope: scopeA,
      accommodationId: 7,
      isInWishlist: true,
    });

    expect(client.getQueryData<SearchResultPage>(keyA)?.accommodations).toEqual(
      [expect.objectContaining({ isInWishlist: true })],
    );
    expect(client.getQueryData<SearchResultPage>(keyB)?.accommodations).toEqual(
      [expect.objectContaining({ isInWishlist: false })],
    );
  });

  it("preserves references when the accommodation or value does not change", () => {
    const client = new QueryClient();
    const original = page(false);
    const key = seedScopedQuery(client, scopeA, original);
    const projection = createSearchQueryCacheProjection(client);

    projection.membershipReconciled({
      scope: scopeA,
      accommodationId: 99,
      isInWishlist: true,
    });
    expect(client.getQueryData(key)).toBe(original);

    projection.membershipReconciled({
      scope: scopeA,
      accommodationId: 7,
      isInWishlist: false,
    });
    expect(client.getQueryData(key)).toBe(original);
  });

  it("invalidates only matching scoped reads when membership is unknown", () => {
    const client = new QueryClient();
    const keyA = seedScopedQuery(client, scopeA, page(false));
    const keyB = seedScopedQuery(client, scopeB, page(false));

    createSearchQueryCacheProjection(client).membershipRefreshRequired({
      scope: scopeA,
    });

    expect(client.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keyB)?.isInvalidated).toBe(false);
  });
});
