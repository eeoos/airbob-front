import { useInfiniteQuery } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { wishlistApi } from "../../../api";
import { WishlistAccommodationInfos } from "../../../types/wishlist";
import { WISHLIST_PAGE_SIZE } from "../lib/wishlistListQueryParams";
import { wishlistQueryKeys } from "../queryKeys";

type WishlistDetailQueryOptions = {
  enabled?: boolean;
  paramsSignature?: string;
  wishlistId: number | null;
};

const getNextCursor = (page: WishlistAccommodationInfos) =>
  page.page_info.has_next ? page.page_info.next_cursor ?? undefined : undefined;

const getWishlistDetailParams = ({ cursor }: { cursor?: string | null }) => ({
  ...(cursor ? { cursor } : {}),
  size: WISHLIST_PAGE_SIZE,
});

export function useWishlistDetailQuery({
  enabled = true,
  paramsSignature = "",
  wishlistId,
}: WishlistDetailQueryOptions) {
  const queryEnabled = enabled && wishlistId !== null;
  const queryWishlistId = wishlistId ?? 0;

  return useInfiniteQuery<
    WishlistAccommodationInfos,
    unknown,
    InfiniteData<WishlistAccommodationInfos, string | null>,
    ReturnType<typeof wishlistQueryKeys.detail>,
    string | null
  >({
    queryKey: wishlistQueryKeys.detail(queryWishlistId, paramsSignature),
    queryFn: ({ pageParam }) =>
      wishlistApi.getWishlistAccommodations(
        queryWishlistId,
        getWishlistDetailParams({ cursor: pageParam })
      ),
    initialPageParam: null,
    getNextPageParam: getNextCursor,
    enabled: queryEnabled,
    throwOnError: false,
  });
}
