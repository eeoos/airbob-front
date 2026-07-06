import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { accommodationApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { useHandledQueryError } from "../../../query/useHandledQueryError";
import {
  MyAccommodationInfo,
  MyAccommodationInfos,
} from "../../../types/accommodation";
import { AccommodationStatus } from "../../../types/enums";
import { profileQueryKeys } from "../queryKeys";

const HOST_LISTINGS_PAGE_SIZE = 20;

export type HostListingStatusType = "PUBLISHED" | "DRAFT" | "UNPUBLISHED";

const getHostListingsParamsSignature = (statusType: HostListingStatusType) => {
  const params = new URLSearchParams();
  params.set("size", HOST_LISTINGS_PAGE_SIZE.toString());
  params.set("status", statusType);

  return params.toString();
};

export function useHostListings(statusType: HostListingStatusType) {
  const queryClient = useQueryClient();
  const { error, handleError, clearError } = useApiError();
  const queryKey = useMemo(
    () => profileQueryKeys.hostListings(getHostListingsParamsSignature(statusType)),
    [statusType],
  );

  const hostListingsQuery = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }: { pageParam?: string }) => {
      clearError();
      return accommodationApi.getMyAccommodations({
        cursor: pageParam,
        size: HOST_LISTINGS_PAGE_SIZE,
        status: statusType as AccommodationStatus,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: MyAccommodationInfos) =>
      lastPage.page_info.has_next
        ? lastPage.page_info.next_cursor ?? undefined
        : undefined,
    retry: false,
    throwOnError: false,
  });

  const accommodations: MyAccommodationInfo[] = useMemo(
    () =>
      hostListingsQuery.data?.pages.flatMap(
        (page) => page.accommodations,
      ) ?? [],
    [hostListingsQuery.data],
  );

  useHandledQueryError({
    error: hostListingsQuery.error,
    errorUpdatedAt: hostListingsQuery.errorUpdatedAt,
    isError: hostListingsQuery.isError,
    onError: handleError,
  });

  const loadMore = useCallback(async () => {
    if (
      !hostListingsQuery.hasNextPage ||
      hostListingsQuery.isFetchingNextPage
    ) {
      return;
    }

    await hostListingsQuery.fetchNextPage({ cancelRefetch: false });
  }, [hostListingsQuery]);

  const reload = useCallback(async () => {
    clearError();
    await queryClient.resetQueries({ queryKey, exact: true });
  }, [clearError, queryClient, queryKey]);

  return {
    accommodations,
    clearError,
    error,
    hasNext: Boolean(hostListingsQuery.hasNextPage),
    isLoading:
      hostListingsQuery.isLoading ||
      (hostListingsQuery.isFetching && accommodations.length === 0),
    isLoadingMore: hostListingsQuery.isFetchingNextPage,
    loadMore,
    reload,
  };
}
