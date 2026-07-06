import { useInfiniteQuery } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { wishlistApi } from "../../../api";
import { WishlistInfos } from "../../../types/wishlist";
import {
  getWishlistListParams,
  getWishlistListsParamsSignature,
  WISHLIST_PAGE_SIZE,
} from "../lib/wishlistListQueryParams";
import { wishlistQueryKeys } from "../queryKeys";

export { getWishlistListsParamsSignature, WISHLIST_PAGE_SIZE };

type WishlistListsQueryOptions = {
  accommodationId?: number;
  enabled?: boolean;
  paramsSignature?: string;
};

const getNextCursor = (page: WishlistInfos) =>
  page.page_info.has_next ? page.page_info.next_cursor ?? undefined : undefined;

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
