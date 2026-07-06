import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { accommodationApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
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
  const { error, handleError, clearError } = useApiError();
  const handledErrorUpdatedAtRef = useRef(0);
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

  useEffect(() => {
    if (
      !hostListingsQuery.error ||
      handledErrorUpdatedAtRef.current === hostListingsQuery.errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current = hostListingsQuery.errorUpdatedAt;
    handleError(hostListingsQuery.error);
  }, [
    hostListingsQuery.error,
    hostListingsQuery.errorUpdatedAt,
    handleError,
  ]);

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
    await hostListingsQuery.refetch();
  }, [clearError, hostListingsQuery]);

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
