import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import type { RecentlyViewedApiPort, WishlistApiPort } from "../ports";
import {
  createRecentlyViewedQueryOptions,
  createWishlistDetailQueryOptions,
  createWishlistListsQueryOptions,
} from "./readQueries";

const scope = {
  subject: "subject:member_7",
  epoch: 4,
} as AuthenticatedSessionScope;

const getWishlists = vi.fn<WishlistApiPort["getWishlists"]>();
const getWishlistAccommodations =
  vi.fn<WishlistApiPort["getWishlistAccommodations"]>();
const wishlistApi = {
  getWishlists,
  getWishlistAccommodations,
} as unknown as WishlistApiPort;

const getRecentlyViewed = vi.fn<RecentlyViewedApiPort["getRecentlyViewed"]>();
const recentlyViewedApi = {
  getRecentlyViewed,
} as unknown as RecentlyViewedApiPort;

describe("wishlist read query contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("puts explicit identity scope in both list key and meta and forwards pagination signal", async () => {
    const signal = new AbortController().signal;
    const options = createWishlistListsQueryOptions(
      {
        scope,
        accommodationId: 31,
      },
      wishlistApi,
    );
    getWishlists.mockResolvedValue({
      wishlists: [],
      pageInfo: { hasNext: false, nextCursor: null, currentSize: 0 },
    });

    await options.queryFn({ pageParam: "cursor-1", signal });

    expect(options.queryKey).toEqual([
      "wishlist",
      "lists",
      31,
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(options.meta).toEqual({ session: scope });
    expect(wishlistApi.getWishlists).toHaveBeenCalledWith(
      { accommodationId: 31, cursor: "cursor-1", size: 20 },
      { signal },
    );
  });

  it("keeps detail reads disabled without an id and scopes the fallback key", () => {
    const options = createWishlistDetailQueryOptions(
      { scope, wishlistId: null },
      wishlistApi,
    );

    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual([
      "wishlist",
      "detail",
      null,
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(options.meta).toEqual({ session: scope });
  });

  it("preserves explicit disabled policies without changing semantic keys", () => {
    const lists = createWishlistListsQueryOptions(
      { accommodationId: 31, enabled: false, scope },
      wishlistApi,
    );
    const recentlyViewed = createRecentlyViewedQueryOptions(
      { enabled: false, scope },
      recentlyViewedApi,
    );

    expect(lists.enabled).toBe(false);
    expect(lists.queryKey).toEqual([
      "wishlist",
      "lists",
      31,
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(recentlyViewed.enabled).toBe(false);
    expect(recentlyViewed.queryKey).toEqual([
      "wishlist",
      "recentlyViewed",
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
  });

  it("forwards detail cursor and AbortSignal through the feature API port", async () => {
    const signal = new AbortController().signal;
    const options = createWishlistDetailQueryOptions(
      { scope, wishlistId: 7 },
      wishlistApi,
    );
    getWishlistAccommodations.mockResolvedValue({
      accommodations: [],
      pageInfo: { hasNext: false, nextCursor: null, currentSize: 0 },
    });

    await options.queryFn({ pageParam: "cursor-1", signal });

    expect(wishlistApi.getWishlistAccommodations).toHaveBeenCalledWith(
      7,
      { cursor: "cursor-1", size: 20 },
      { signal },
    );
  });

  it("stops list and detail pagination when the backend repeats an earlier cursor", () => {
    const listOptions = createWishlistListsQueryOptions({ scope }, wishlistApi);
    const detailOptions = createWishlistDetailQueryOptions(
      { scope, wishlistId: 7 },
      wishlistApi,
    );
    const listPage = {
      wishlists: [],
      pageInfo: {
        currentSize: 0,
        hasNext: true,
        nextCursor: "cursor-1",
      },
    };
    const detailPage = {
      accommodations: [],
      pageInfo: {
        currentSize: 0,
        hasNext: true,
        nextCursor: "cursor-1",
      },
    };

    expect(
      listOptions.getNextPageParam(listPage, [listPage], "cursor-1", [
        null,
        "cursor-1",
      ]),
    ).toBeUndefined();
    expect(
      detailOptions.getNextPageParam(detailPage, [detailPage], "cursor-1", [
        null,
        "cursor-1",
      ]),
    ).toBeUndefined();
  });

  it("scopes recently viewed reads and forwards AbortSignal", async () => {
    const signal = new AbortController().signal;
    const options = createRecentlyViewedQueryOptions(
      { scope },
      recentlyViewedApi,
    );
    getRecentlyViewed.mockResolvedValue({
      accommodations: [],
      totalCount: 0,
    });

    await options.queryFn({ signal });

    expect(options.queryKey).toEqual([
      "wishlist",
      "recentlyViewed",
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(options.enabled).toBe(true);
    expect(options.meta).toEqual({ session: scope });
    expect(recentlyViewedApi.getRecentlyViewed).toHaveBeenCalledWith({
      signal,
    });
  });

  it("produces distinct keys when either subject or epoch changes", () => {
    const base = createRecentlyViewedQueryOptions({ scope }, recentlyViewedApi);
    const nextEpoch = createRecentlyViewedQueryOptions(
      { scope: { ...scope, epoch: 5 } },
      recentlyViewedApi,
    );
    const nextSubject = createRecentlyViewedQueryOptions(
      {
        scope: {
          ...scope,
          subject: "subject:member_8" as AuthenticatedSessionScope["subject"],
        },
      },
      recentlyViewedApi,
    );

    expect(base.queryKey).not.toEqual(nextEpoch.queryKey);
    expect(base.queryKey).not.toEqual(nextSubject.queryKey);
  });
});
