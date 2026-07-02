import { useCallback, useEffect, useRef, useState } from "react";
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
  const loadingMoreRef = useRef(false);
  const requestIdRef = useRef(0);

  const applyPageInfo = (pageInfo: CursorPageInfo) => {
    setCursor(pageInfo.next_cursor);
    setHasNext(pageInfo.has_next);
  };

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    loadingMoreRef.current = false;
    setIsLoading(true);
    setIsLoadingMore(false);
    clearError();
    setAccommodations([]);
    setCursor(null);
    setHasNext(false);

    try {
      const response = await accommodationApi.getMyAccommodations({
        size: HOST_LISTINGS_PAGE_SIZE,
        status: statusType as AccommodationStatus,
      });

      if (requestIdRef.current !== requestId) return;

      setAccommodations(response.accommodations);
      applyPageInfo(response.page_info);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;

      handleError(err);
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [clearError, handleError, statusType]);

  useEffect(() => {
    reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!hasNext || loadingMoreRef.current || !cursor) return;

    const requestId = requestIdRef.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    clearError();

    try {
      const response = await accommodationApi.getMyAccommodations({
        cursor,
        size: HOST_LISTINGS_PAGE_SIZE,
        status: statusType as AccommodationStatus,
      });

      if (requestIdRef.current !== requestId) return;

      setAccommodations((prev) => [...prev, ...response.accommodations]);
      applyPageInfo(response.page_info);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;

      handleError(err);
    } finally {
      if (requestIdRef.current === requestId) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [clearError, cursor, handleError, hasNext, statusType]);

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
