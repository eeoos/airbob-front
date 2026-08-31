import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { requireDefined } from "../../../test/assertions";
import { recentlyViewedApi, wishlistApi } from "../api";
import type { WishlistCollection, WishlistDetail } from "../model";
import {
  useRecentlyViewedReadQuery,
  useWishlistDetailReadQuery,
  useWishlistListsReadQuery,
} from "./readQueries";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return {
    ...actual,
    useInfiniteQuery: vi.fn(),
    useQuery: vi.fn(),
  };
});

interface CapturedInfiniteQueryOptions<TPage> {
  readonly queryKey: readonly unknown[];
  readonly queryFn: (context: {
    readonly pageParam: string | null;
    readonly signal: AbortSignal;
  }) => Promise<unknown>;
  readonly enabled: boolean;
  readonly getNextPageParam: (
    page: TPage,
    allPages: TPage[],
    lastPageParam: string | null,
    allPageParams: (string | null)[],
  ) => string | undefined;
  readonly meta: unknown;
}

interface CapturedQueryOptions {
  readonly queryKey: readonly unknown[];
  readonly queryFn: (context: {
    readonly signal: AbortSignal;
  }) => Promise<unknown>;
  readonly enabled: boolean;
  readonly meta: unknown;
}

const mockUseInfiniteQuery = vi.mocked(useInfiniteQuery);
const mockUseQuery = vi.mocked(useQuery);

const getCapturedInfiniteOptions = <
  TPage,
>(): CapturedInfiniteQueryOptions<TPage> =>
  requireDefined(
    mockUseInfiniteQuery.mock.calls.at(-1),
    "useInfiniteQuery call",
  )[0] as unknown as CapturedInfiniteQueryOptions<TPage>;

const getCapturedQueryOptions = (): CapturedQueryOptions =>
  requireDefined(
    mockUseQuery.mock.calls.at(-1),
    "useQuery call",
  )[0] as unknown as CapturedQueryOptions;

const scope = {
  subject: "subject:member_7",
  epoch: 4,
} as AuthenticatedSessionScope;

describe("wishlist read query contracts", () => {
  beforeEach(() => {
    mockUseInfiniteQuery.mockReset();
    mockUseInfiniteQuery.mockReturnValue(
      {} as ReturnType<typeof useInfiniteQuery>,
    );
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue({} as ReturnType<typeof useQuery>);
    vi.restoreAllMocks();
  });

  it("puts explicit identity scope in both list key and meta and forwards pagination signal", async () => {
    const signal = new AbortController().signal;
    const getWishlists = vi
      .spyOn(wishlistApi, "getWishlists")
      .mockResolvedValue({
        wishlists: [],
        pageInfo: { hasNext: false, nextCursor: null, currentSize: 0 },
      });

    useWishlistListsReadQuery({ scope, accommodationId: 31 });
    const options = getCapturedInfiniteOptions<WishlistCollection>();

    await options.queryFn({ pageParam: "cursor-1", signal });

    expect(options.queryKey).toEqual([
      "wishlist",
      "lists",
      31,
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(options.meta).toEqual({ session: scope });
    expect(getWishlists).toHaveBeenCalledWith(
      { accommodationId: 31, cursor: "cursor-1", size: 20 },
      { signal },
    );
  });

  it("keeps detail reads disabled without an id and scopes the fallback key", () => {
    useWishlistDetailReadQuery({ scope, wishlistId: null });
    const options = getCapturedInfiniteOptions<WishlistDetail>();

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
    useWishlistListsReadQuery({
      accommodationId: 31,
      enabled: false,
      scope,
    });
    const lists = getCapturedInfiniteOptions<WishlistCollection>();
    useRecentlyViewedReadQuery({ enabled: false, scope });
    const recentlyViewed = getCapturedQueryOptions();

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
    const getWishlistAccommodations = vi
      .spyOn(wishlistApi, "getWishlistAccommodations")
      .mockResolvedValue({
        accommodations: [],
        pageInfo: { hasNext: false, nextCursor: null, currentSize: 0 },
      });

    useWishlistDetailReadQuery({ scope, wishlistId: 7 });
    const options = getCapturedInfiniteOptions<WishlistDetail>();

    await options.queryFn({ pageParam: "cursor-1", signal });

    expect(getWishlistAccommodations).toHaveBeenCalledWith(
      7,
      { cursor: "cursor-1", size: 20 },
      { signal },
    );
  });

  it("stops list and detail pagination when the backend repeats an earlier cursor", () => {
    useWishlistListsReadQuery({ scope });
    const listOptions = getCapturedInfiniteOptions<WishlistCollection>();
    useWishlistDetailReadQuery({ scope, wishlistId: 7 });
    const detailOptions = getCapturedInfiniteOptions<WishlistDetail>();
    const listPage: WishlistCollection = {
      wishlists: [],
      pageInfo: {
        currentSize: 0,
        hasNext: true,
        nextCursor: "cursor-1",
      },
    };
    const detailPage: WishlistDetail = {
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
    const getRecentlyViewed = vi
      .spyOn(recentlyViewedApi, "getRecentlyViewed")
      .mockResolvedValue({ accommodations: [], totalCount: 0 });

    useRecentlyViewedReadQuery({ scope });
    const options = getCapturedQueryOptions();

    await options.queryFn({ signal });

    expect(options.queryKey).toEqual([
      "wishlist",
      "recentlyViewed",
      { session: { subject: scope.subject, epoch: 4 } },
    ]);
    expect(options.enabled).toBe(true);
    expect(options.meta).toEqual({ session: scope });
    expect(getRecentlyViewed).toHaveBeenCalledWith({ signal });
  });

  it("produces distinct keys when either subject or epoch changes", () => {
    useRecentlyViewedReadQuery({ scope });
    const base = getCapturedQueryOptions();
    useRecentlyViewedReadQuery({ scope: { ...scope, epoch: 5 } });
    const nextEpoch = getCapturedQueryOptions();
    useRecentlyViewedReadQuery({
      scope: {
        ...scope,
        subject: "subject:member_8" as AuthenticatedSessionScope["subject"],
      },
    });
    const nextSubject = getCapturedQueryOptions();

    expect(base.queryKey).not.toEqual(nextEpoch.queryKey);
    expect(base.queryKey).not.toEqual(nextSubject.queryKey);
  });
});
