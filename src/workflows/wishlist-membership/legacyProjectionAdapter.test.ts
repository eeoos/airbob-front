import { QueryClient } from "@tanstack/react-query";
import { createSessionQueryMeta } from "../../platform/query/sessionScope";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import type { AccommodationSearchResponse } from "../../types/accommodation";
import { accommodationQueryKeys } from "../../features/accommodations/queryKeys";
import { searchQueryKeys } from "../../features/search/queryKeys";
import { wishlistReadQueryKeys } from "../../features/wishlist/queries";
import type { RecentlyViewedCollection } from "../../features/wishlist/model";
import { createLegacyWishlistProjectionAdapter } from "./legacyProjectionAdapter";

const scope: AuthenticatedSessionScope = {
  subject: "subject:member_7" as SessionSubject,
  epoch: 3,
};

const seedScopedQueryData = <TData,>(
  client: QueryClient,
  queryKey: readonly unknown[],
  data: TData,
) => {
  client.setQueryDefaults(queryKey, { meta: createSessionQueryMeta(scope) });
  client.setQueryData(queryKey, data);
};

const searchResponse: AccommodationSearchResponse = {
  stay_search_result_listing: [{
    id: 7,
    name: "stay",
    accommodation_thumbnail_url: null,
    base_price: 100,
    currency: "KRW",
    type: "HOUSE",
    address_summary: { country: "KR", state: null, city: "Seoul", district: null },
    coordinate: { latitude: 37.5, longitude: 127 },
    review_summary: { total_count: 0, average_rating: 0 },
    is_in_wishlist: false,
  }],
  page_info: {
    current_page: 0,
    page_size: 20,
    total_elements: 1,
    total_pages: 1,
    is_first: true,
    is_last: true,
    has_next: false,
    has_previous: false,
  },
};

describe("legacy wishlist projection adapter", () => {
  it("projects one confirmed membership result across current compatibility caches", () => {
    const client = new QueryClient();
    const recentKey = wishlistReadQueryKeys.recentlyViewed(scope);
    const searchKey = searchQueryKeys.results("destination=Seoul");
    const detailKey = accommodationQueryKeys.detail(7, 0);
    seedScopedQueryData<RecentlyViewedCollection>(client, recentKey, {
      totalCount: 1,
      accommodations: [{
        accommodationId: 7,
        accommodationName: "stay",
        viewedAt: "2026-08-29T00:00:00Z",
        thumbnailUrl: null,
        addressSummary: null,
        reviewSummary: null,
        isInWishlist: false,
      }],
    });
    client.setQueryData(searchKey, searchResponse);
    client.setQueryData(detailKey, {
      id: 7,
      is_in_wishlist: false,
    });

    createLegacyWishlistProjectionAdapter(client).membershipReconciled({
      scope,
      accommodationId: 7,
      isInAnyWishlist: true,
    });

    expect(client.getQueryData<RecentlyViewedCollection>(recentKey)?.accommodations[0].isInWishlist).toBe(true);
    expect(client.getQueryData<AccommodationSearchResponse>(searchKey)?.stay_search_result_listing[0].is_in_wishlist).toBe(true);
    expect(client.getQueryData<{ is_in_wishlist: boolean }>(detailKey)?.is_in_wishlist).toBe(true);
  });

  it("contains no mutation transport dependency", () => {
    const source = require("fs").readFileSync(__filename.replace(/\.test\.ts$/, ".ts"), "utf8");

    expect(source).not.toMatch(/features\/wishlist\/api|wishlistApi|recentlyViewedApi/);
    expect(source).not.toMatch(/\.(post|patch|delete)\s*\(/);
  });

  it("invalidates owned wishlist data and refreshes only the named legacy query roots", () => {
    const client = new QueryClient();
    const invalidateQueries = jest.spyOn(client, "invalidateQueries");
    const removeQueries = jest.spyOn(client, "removeQueries");

    createLegacyWishlistProjectionAdapter(client).membershipRefreshRequired({
      scope,
      accommodationId: 7,
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      predicate: expect.any(Function),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["search"],
      type: "active",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["accommodation", "detail"],
      type: "active",
    });
    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: ["search"],
      type: "inactive",
    });
    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: ["accommodation", "detail"],
      type: "inactive",
    });
  });
});
