import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { recentlyViewedApi, wishlistApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { RecentlyViewedAccommodationInfos } from "../../../types/recentlyViewed";
import {
  WishlistAccommodationInfos,
  WishlistInfos,
} from "../../../types/wishlist";
import { searchQueryKeys } from "../../search/queryKeys";
import { fetchAccommodationWishlistMembership } from "../lib/wishlistMembership";
import { wishlistQueryKeys } from "../queryKeys";
import { useRecentlyViewedQuery } from "./useRecentlyViewedQuery";
import { useWishlistDetailQuery } from "./useWishlistDetailQuery";
import {
  getWishlistListsParamsSignature,
  useWishlistListsQuery,
} from "./useWishlistListsQuery";

type UseWishlistDataOptions = {
  selectedWishlistId: number | null;
  showRecentlyViewed: boolean;
};

type WishlistListsInfiniteData = InfiniteData<
  WishlistInfos,
  string | null
>;
type WishlistDetailInfiniteData = InfiniteData<
  WishlistAccommodationInfos,
  string | null
>;

const wishlistListsQueryPrefix = [...wishlistQueryKeys.all, "lists"] as const;
const wishlistDetailQueryPrefix = [...wishlistQueryKeys.all, "detail"] as const;
const getWishlistDetailQueryPrefix = (wishlistId: number) =>
  [...wishlistQueryKeys.all, "detail", wishlistId] as const;

const removeWishlistFromPages = (
  data: WishlistListsInfiniteData | undefined,
  wishlistId: number
) =>
  data
    ? {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          wishlists: page.wishlists.filter(
            (wishlist) => wishlist.id !== wishlistId
          ),
        })),
      }
    : data;

const removeAccommodationFromPages = (
  data: WishlistDetailInfiniteData | undefined,
  wishlistAccommodationId: number
) =>
  data
    ? {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          wishlist_accommodations: page.wishlist_accommodations.filter(
            (item) =>
              item.wishlist_accommodation_id !== wishlistAccommodationId
          ),
        })),
      }
    : data;

const updateAccommodationMemoInPages = (
  data: WishlistDetailInfiniteData | undefined,
  wishlistAccommodationId: number,
  memo: string
) =>
  data
    ? {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          wishlist_accommodations: page.wishlist_accommodations.map((item) =>
            item.wishlist_accommodation_id === wishlistAccommodationId
              ? { ...item, memo }
              : item
          ),
        })),
      }
    : data;

const removeRecentlyViewedAccommodation = (
  data: RecentlyViewedAccommodationInfos | undefined,
  accommodationId: number
) => {
  if (!data) return data;

  const accommodations = data.accommodations.filter(
    (item) => item.accommodation_id !== accommodationId
  );

  return {
    ...data,
    accommodations,
    total_count:
      accommodations.length === data.accommodations.length
        ? data.total_count
        : Math.max(0, data.total_count - 1),
  };
};

const updateRecentlyViewedWishlistState = (
  data: RecentlyViewedAccommodationInfos | undefined,
  accommodationId: number,
  getNextValue: (currentValue: boolean) => boolean
) =>
  data
    ? {
        ...data,
        accommodations: data.accommodations.map((item) =>
          item.accommodation_id === accommodationId
            ? {
                ...item,
                is_in_wishlist: getNextValue(item.is_in_wishlist),
              }
            : item
        ),
      }
    : data;

export function useWishlistData({
  selectedWishlistId,
  showRecentlyViewed,
}: UseWishlistDataOptions) {
  const queryClient = useQueryClient();
  const { error, handleError, clearError } = useApiError();
  const recentlyViewedQuery = useRecentlyViewedQuery();
  const wishlistsQuery = useWishlistListsQuery();
  const wishlistDetailQuery = useWishlistDetailQuery({
    wishlistId: selectedWishlistId,
    enabled: Boolean(selectedWishlistId) && !showRecentlyViewed,
  });
  const handledErrorUpdatedAtRef = useRef({
    detail: 0,
    recentlyViewed: 0,
    wishlists: 0,
  });

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (
      !recentlyViewedQuery.isError ||
      !recentlyViewedQuery.error ||
      handledErrorUpdatedAtRef.current.recentlyViewed ===
        recentlyViewedQuery.errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current.recentlyViewed =
      recentlyViewedQuery.errorUpdatedAt;
    handleError(recentlyViewedQuery.error);
  }, [
    handleError,
    recentlyViewedQuery.error,
    recentlyViewedQuery.errorUpdatedAt,
    recentlyViewedQuery.isError,
  ]);

  useEffect(() => {
    if (
      !wishlistsQuery.isError ||
      !wishlistsQuery.error ||
      handledErrorUpdatedAtRef.current.wishlists ===
        wishlistsQuery.errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current.wishlists = wishlistsQuery.errorUpdatedAt;
    handleError(wishlistsQuery.error);
  }, [
    handleError,
    wishlistsQuery.error,
    wishlistsQuery.errorUpdatedAt,
    wishlistsQuery.isError,
  ]);

  useEffect(() => {
    if (
      !wishlistDetailQuery.isError ||
      !wishlistDetailQuery.error ||
      handledErrorUpdatedAtRef.current.detail ===
        wishlistDetailQuery.errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current.detail =
      wishlistDetailQuery.errorUpdatedAt;
    handleError(wishlistDetailQuery.error);
  }, [
    handleError,
    wishlistDetailQuery.error,
    wishlistDetailQuery.errorUpdatedAt,
    wishlistDetailQuery.isError,
  ]);

  const recentlyViewed = recentlyViewedQuery.data?.accommodations ?? [];
  const wishlists = useMemo(
    () =>
      wishlistsQuery.data?.pages.flatMap((page) => page?.wishlists ?? []) ?? [],
    [wishlistsQuery.data]
  );
  const wishlistAccommodations = useMemo(
    () =>
      wishlistDetailQuery.data?.pages.flatMap(
        (page) => page?.wishlist_accommodations ?? []
      ) ?? [],
    [wishlistDetailQuery.data]
  );

  const removeRecentlyViewedMutation = useMutation({
    mutationFn: (accommodationId: number) =>
      recentlyViewedApi.remove(accommodationId),
    onSuccess: (_data, accommodationId) => {
      queryClient.setQueryData<RecentlyViewedAccommodationInfos>(
        wishlistQueryKeys.recentlyViewed(),
        (prev: RecentlyViewedAccommodationInfos | undefined) =>
          removeRecentlyViewedAccommodation(prev, accommodationId)
      );
    },
  });

  const deleteWishlistMutation = useMutation({
    mutationFn: (wishlistId: number) => wishlistApi.delete(wishlistId),
    onSuccess: (_data, wishlistId) => {
      queryClient.setQueriesData<WishlistListsInfiniteData>(
        { queryKey: wishlistListsQueryPrefix },
        (prev: WishlistListsInfiniteData | undefined) =>
          removeWishlistFromPages(prev, wishlistId)
      );
      queryClient.removeQueries({
        queryKey: getWishlistDetailQueryPrefix(wishlistId),
      });
      queryClient.invalidateQueries({
        queryKey: wishlistQueryKeys.recentlyViewed(),
      });
      queryClient.invalidateQueries({
        queryKey: searchQueryKeys.all,
      });
    },
  });

  const removeFromWishlistMutation = useMutation({
    mutationFn: (wishlistAccommodationId: number) =>
      wishlistApi.removeAccommodation(wishlistAccommodationId),
    onSuccess: (_data, wishlistAccommodationId) => {
      queryClient.setQueriesData<WishlistDetailInfiniteData>(
        { queryKey: wishlistDetailQueryPrefix },
        (prev: WishlistDetailInfiniteData | undefined) =>
          removeAccommodationFromPages(prev, wishlistAccommodationId)
      );
      queryClient.invalidateQueries({
        queryKey: wishlistListsQueryPrefix,
      });
      queryClient.invalidateQueries({
        queryKey: wishlistQueryKeys.recentlyViewed(),
      });
      queryClient.invalidateQueries({
        queryKey: searchQueryKeys.all,
      });
    },
  });

  const saveWishlistAccommodationMemoMutation = useMutation({
    mutationFn: ({
      memo,
      wishlistAccommodationId,
    }: {
      memo: string;
      wishlistAccommodationId: number;
    }) =>
      wishlistApi.updateAccommodationMemo(wishlistAccommodationId, {
        memo,
      }),
    onSuccess: (_data, { memo, wishlistAccommodationId }) => {
      queryClient.setQueriesData<WishlistDetailInfiniteData>(
        { queryKey: wishlistDetailQueryPrefix },
        (prev: WishlistDetailInfiniteData | undefined) =>
          updateAccommodationMemoInPages(
            prev,
            wishlistAccommodationId,
            memo
          )
      );
    },
  });

  const reloadRecentlyViewed = useCallback(async () => {
    clearError();
    await recentlyViewedQuery.refetch();
  }, [clearError, recentlyViewedQuery]);

  const loadMoreWishlistAccommodations = useCallback(async () => {
    if (
      !selectedWishlistId ||
      showRecentlyViewed ||
      !wishlistDetailQuery.hasNextPage ||
      wishlistDetailQuery.isFetchingNextPage
    ) {
      return;
    }

    clearError();
    await wishlistDetailQuery.fetchNextPage();
  }, [
    clearError,
    selectedWishlistId,
    showRecentlyViewed,
    wishlistDetailQuery,
  ]);

  const loadMoreWishlists = useCallback(async () => {
    if (!wishlistsQuery.hasNextPage || wishlistsQuery.isFetchingNextPage) {
      return;
    }

    clearError();
    await wishlistsQuery.fetchNextPage();
  }, [clearError, wishlistsQuery]);

  const removeRecentlyViewed = useCallback(
    async (accommodationId: number) => {
      clearError();

      try {
        await removeRecentlyViewedMutation.mutateAsync(accommodationId);
      } catch (err) {
        handleError(err);
      }
    },
    [clearError, handleError, removeRecentlyViewedMutation]
  );

  const deleteWishlist = useCallback(
    async (wishlistId: number) => {
      clearError();

      try {
        await deleteWishlistMutation.mutateAsync(wishlistId);
        return true;
      } catch (err) {
        handleError(err);
        return false;
      }
    },
    [clearError, deleteWishlistMutation, handleError]
  );

  const removeFromWishlist = useCallback(
    async (wishlistAccommodationId: number) => {
      clearError();

      try {
        await removeFromWishlistMutation.mutateAsync(wishlistAccommodationId);
      } catch (err) {
        handleError(err);
      }
    },
    [clearError, handleError, removeFromWishlistMutation]
  );

  const saveWishlistAccommodationMemo = useCallback(
    async (wishlistAccommodationId: number, memo: string) => {
      const trimmedMemo = memo.trim();
      if (!trimmedMemo) return false;

      clearError();

      try {
        await saveWishlistAccommodationMemoMutation.mutateAsync({
          wishlistAccommodationId,
          memo: trimmedMemo,
        });
        return true;
      } catch (err) {
        handleError(err);
        return false;
      }
    },
    [clearError, handleError, saveWishlistAccommodationMemoMutation]
  );

  const toggleRecentlyViewedWishlistState = useCallback(
    (accommodationId: number) => {
      queryClient.setQueryData<RecentlyViewedAccommodationInfos>(
        wishlistQueryKeys.recentlyViewed(),
        (prev: RecentlyViewedAccommodationInfos | undefined) =>
          updateRecentlyViewedWishlistState(
            prev,
            accommodationId,
            (isInWishlist) => !isInWishlist
          )
      );
    },
    [queryClient]
  );

  const refreshRecentlyViewedWishlistState = useCallback(
    async (accommodationId: number) => {
      clearError();

      try {
        const { isInAnyWishlist, pageParams, pages } =
          await fetchAccommodationWishlistMembership(accommodationId);

        queryClient.setQueryData<RecentlyViewedAccommodationInfos>(
          wishlistQueryKeys.recentlyViewed(),
          (prev: RecentlyViewedAccommodationInfos | undefined) =>
            updateRecentlyViewedWishlistState(
              prev,
              accommodationId,
              () => isInAnyWishlist
            )
        );

        queryClient.setQueryData<WishlistListsInfiniteData>(
          wishlistQueryKeys.lists(
            getWishlistListsParamsSignature({ accommodationId })
          ),
          {
            pageParams,
            pages,
          }
        );
      } catch (err) {
        handleError(err);
      }
    },
    [clearError, handleError, queryClient]
  );

  const isDetailQueryEnabled =
    Boolean(selectedWishlistId) && !showRecentlyViewed;
  const isLoading = useMemo(
    () =>
      recentlyViewedQuery.isFetching ||
      wishlistsQuery.isLoading ||
      (isDetailQueryEnabled &&
        wishlistDetailQuery.isFetching &&
        !wishlistDetailQuery.isFetchingNextPage),
    [
      isDetailQueryEnabled,
      recentlyViewedQuery.isFetching,
      wishlistDetailQuery.isFetching,
      wishlistDetailQuery.isFetchingNextPage,
      wishlistsQuery.isLoading,
    ]
  );

  return {
    clearError,
    deleteWishlist,
    error,
    hasNext: wishlistDetailQuery.hasNextPage,
    isLoading,
    isLoadingMore: wishlistDetailQuery.isFetchingNextPage,
    isLoadingMoreWishlists: wishlistsQuery.isFetchingNextPage,
    loadMoreWishlistAccommodations,
    loadMoreWishlists,
    refreshRecentlyViewedWishlistState,
    recentlyViewed,
    reloadRecentlyViewed,
    removeFromWishlist,
    removeRecentlyViewed,
    saveWishlistAccommodationMemo,
    toggleRecentlyViewedWishlistState,
    wishlistAccommodations,
    wishlists,
    wishlistsHasNext: wishlistsQuery.hasNextPage,
  };
}
