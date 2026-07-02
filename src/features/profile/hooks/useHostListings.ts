import { useCallback, useEffect, useState } from "react";
import { accommodationApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { MyAccommodationInfo } from "../../../types/accommodation";
import { CursorPageInfo } from "../../../types/api";
import { AccommodationStatus } from "../../../types/enums";

const HOST_LISTINGS_PAGE_SIZE = 20;

export type HostListingStatusType = "PUBLISHED" | "DRAFT" | "UNPUBLISHED";

export function useHostListings(statusType: HostListingStatusType) {
  const { error, handleError, clearError } = useApiError();
  const [accommodations, setAccommodations] = useState<MyAccommodationInfo[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);

  const applyPageInfo = (pageInfo: CursorPageInfo) => {
    setCursor(pageInfo.next_cursor);
    setHasNext(pageInfo.has_next);
  };

  const reload = useCallback(async () => {
    setIsLoading(true);
    clearError();
    setAccommodations([]);
    setCursor(null);
    setHasNext(false);

    try {
      const response = await accommodationApi.getMyAccommodations({
        size: HOST_LISTINGS_PAGE_SIZE,
        status: statusType as AccommodationStatus,
      });

      setAccommodations(response.accommodations);
      applyPageInfo(response.page_info);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [clearError, handleError, statusType]);

  useEffect(() => {
    reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!hasNext || isLoadingMore || !cursor) return;

    setIsLoadingMore(true);
    clearError();

    try {
      const response = await accommodationApi.getMyAccommodations({
        cursor,
        size: HOST_LISTINGS_PAGE_SIZE,
        status: statusType as AccommodationStatus,
      });

      setAccommodations((prev) => [...prev, ...response.accommodations]);
      applyPageInfo(response.page_info);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    clearError,
    cursor,
    handleError,
    hasNext,
    isLoadingMore,
    statusType,
  ]);

  return {
    accommodations,
    clearError,
    error,
    hasNext,
    isLoading,
    isLoadingMore,
    loadMore,
    reload,
  };
}
