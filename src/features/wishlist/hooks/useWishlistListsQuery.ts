import { useInfiniteQuery } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { wishlistApi } from "../../../api";
import { WishlistInfos } from "../../../types/wishlist";
import { wishlistQueryKeys } from "../queryKeys";

export const WISHLIST_PAGE_SIZE = 20;

type WishlistListsQueryOptions = {
  accommodationId?: number;
  enabled?: boolean;
  paramsSignature?: string;
};

export const getWishlistListsParamsSignature = ({
  accommodationId,
}: Pick<WishlistListsQueryOptions, "accommodationId"> = {}) =>
  accommodationId === undefined ? "" : `accommodationId=${accommodationId}`;

const getNextCursor = (page: WishlistInfos) =>
  page.page_info.has_next ? page.page_info.next_cursor ?? undefined : undefined;

const getWishlistListParams = ({
  accommodationId,
  cursor,
}: {
  accommodationId?: number;
  cursor?: string | null;
}) => ({
  ...(accommodationId === undefined ? {} : { accommodationId }),
  ...(cursor ? { cursor } : {}),
  size: WISHLIST_PAGE_SIZE,
});

export function useWishlistListsQuery({
  accommodationId,
  enabled = true,
  paramsSignature = getWishlistListsParamsSignature({ accommodationId }),
}: WishlistListsQueryOptions = {}) {
  return useInfiniteQuery<
    WishlistInfos,
    unknown,
    InfiniteData<WishlistInfos, string | null>,
    ReturnType<typeof wishlistQueryKeys.lists>,
    string | null
  >({
    queryKey: wishlistQueryKeys.lists(paramsSignature),
    queryFn: ({ pageParam }) =>
      wishlistApi.getWishlists(
        getWishlistListParams({ accommodationId, cursor: pageParam })
      ),
    initialPageParam: null,
    getNextPageParam: getNextCursor,
    enabled,
    throwOnError: false,
  });
}
