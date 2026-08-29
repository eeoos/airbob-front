import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { createSessionQueryMeta } from "../../../platform/query/sessionScope";
import {
  recentlyViewedApi as defaultRecentlyViewedApi,
  wishlistApi as defaultWishlistApi,
} from "../api";
import type {
  RecentlyViewedCollection,
  WishlistCollection,
  WishlistDetail,
} from "../model";
import type { RecentlyViewedApiPort } from "../ports/recentlyViewedApiPort";
import type { WishlistApiPort } from "../ports/wishlistApiPort";
import { wishlistReadQueryKeys } from "./queryKeys";

export const WISHLIST_PAGE_SIZE = 20;

interface WishlistListQueryParams {
  readonly accommodationId?: number;
  readonly cursor?: string | null;
}

const getWishlistListParams = ({
  accommodationId,
  cursor,
}: WishlistListQueryParams) => ({
  ...(accommodationId === undefined ? {} : { accommodationId }),
  ...(cursor ? { cursor } : {}),
  size: WISHLIST_PAGE_SIZE,
});

const getWishlistDetailParams = ({ cursor }: { cursor?: string | null }) => ({
  ...(cursor ? { cursor } : {}),
  size: WISHLIST_PAGE_SIZE,
});

const getNextCursor = (
  page: WishlistCollection | WishlistDetail,
  allPageParams: readonly (string | null)[],
) => {
  const nextCursor = page.pageInfo.hasNext
    ? page.pageInfo.nextCursor ?? undefined
    : undefined;

  return nextCursor !== undefined && !allPageParams.includes(nextCursor)
    ? nextCursor
    : undefined;
};

const getNextWishlistCursor = (
  page: WishlistCollection,
  _allPages: WishlistCollection[],
  _lastPageParam: string | null,
  allPageParams: (string | null)[],
) => getNextCursor(page, allPageParams);

const getNextDetailCursor = (
  page: WishlistDetail,
  _allPages: WishlistDetail[],
  _lastPageParam: string | null,
  allPageParams: (string | null)[],
) => getNextCursor(page, allPageParams);

export interface WishlistListsQueryOptions {
  readonly scope: AuthenticatedSessionScope;
  readonly accommodationId?: number;
  readonly enabled?: boolean;
}

export const createWishlistListsQueryOptions = (
  {
    scope,
    accommodationId,
    enabled = true,
  }: WishlistListsQueryOptions,
  api: WishlistApiPort = defaultWishlistApi,
) => ({
  queryKey: wishlistReadQueryKeys.lists(scope, accommodationId ?? null),
  queryFn: ({
    pageParam,
    signal,
  }: {
    readonly pageParam: string | null;
    readonly signal: AbortSignal;
  }) =>
    api.getWishlists(
      getWishlistListParams({ accommodationId, cursor: pageParam }),
      { signal },
    ),
  initialPageParam: null as string | null,
  getNextPageParam: getNextWishlistCursor,
  enabled,
  meta: createSessionQueryMeta(scope),
  throwOnError: false as const,
});

export const useWishlistListsReadQuery = (
  options: WishlistListsQueryOptions,
) =>
  useInfiniteQuery<
    WishlistCollection,
    Error,
    InfiniteData<WishlistCollection, string | null>,
    ReturnType<typeof wishlistReadQueryKeys.lists>,
    string | null
  >(createWishlistListsQueryOptions(options));

export interface WishlistDetailQueryOptions {
  readonly scope: AuthenticatedSessionScope;
  readonly enabled?: boolean;
  readonly wishlistId: number | null;
}

export const createWishlistDetailQueryOptions = (
  {
    scope,
    enabled = true,
    wishlistId,
  }: WishlistDetailQueryOptions,
  api: WishlistApiPort = defaultWishlistApi,
) => {
  return {
    queryKey: wishlistReadQueryKeys.detail(scope, wishlistId),
    queryFn: ({
      pageParam,
      signal,
    }: {
      readonly pageParam: string | null;
      readonly signal: AbortSignal;
    }) => {
      if (wishlistId === null) {
        throw new TypeError("wishlistId is required for a detail query.");
      }

      return api.getWishlistAccommodations(
        wishlistId,
        getWishlistDetailParams({ cursor: pageParam }),
        { signal },
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: getNextDetailCursor,
    enabled: enabled && wishlistId !== null,
    meta: createSessionQueryMeta(scope),
    throwOnError: false as const,
  };
};

export const useWishlistDetailReadQuery = (
  options: WishlistDetailQueryOptions,
) =>
  useInfiniteQuery<
    WishlistDetail,
    Error,
    InfiniteData<WishlistDetail, string | null>,
    ReturnType<typeof wishlistReadQueryKeys.detail>,
    string | null
  >(createWishlistDetailQueryOptions(options));

export interface RecentlyViewedQueryOptions {
  readonly scope: AuthenticatedSessionScope;
  readonly enabled?: boolean;
}

export const createRecentlyViewedQueryOptions = (
  { scope, enabled = true }: RecentlyViewedQueryOptions,
  api: RecentlyViewedApiPort = defaultRecentlyViewedApi,
) => ({
  queryKey: wishlistReadQueryKeys.recentlyViewed(scope),
  queryFn: ({ signal }: { readonly signal: AbortSignal }) =>
    api.getRecentlyViewed({ signal }),
  enabled,
  meta: createSessionQueryMeta(scope),
  throwOnError: false as const,
});

export const useRecentlyViewedReadQuery = (
  options: RecentlyViewedQueryOptions,
) =>
  useQuery<
    RecentlyViewedCollection,
    Error,
    RecentlyViewedCollection,
    ReturnType<typeof wishlistReadQueryKeys.recentlyViewed>
  >(createRecentlyViewedQueryOptions(options));
