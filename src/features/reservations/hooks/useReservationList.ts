import { useCallback, useEffect, useRef, useState } from "react";
import { useApiError } from "../../../hooks/useApiError";
import { CursorPageInfo } from "../../../types/api";
import { ReservationFilterType } from "../../../types/reservation";

const RESERVATION_PAGE_SIZE = 20;

type ReservationPage<TReservation> = {
  reservations: TReservation[];
  page_info: CursorPageInfo;
};

type FetchReservationPage<TReservation> = (params: {
  size?: number;
  cursor?: string;
  filterType?: ReservationFilterType;
}) => Promise<ReservationPage<TReservation>>;

export function useReservationList<TReservation>(
  filterType: ReservationFilterType,
  fetchReservationPage: FetchReservationPage<TReservation>
) {
  const { error, handleError, clearError } = useApiError();
  const [reservations, setReservations] = useState<TReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const applyPageInfo = (pageInfo: CursorPageInfo) => {
    setCursor(pageInfo.next_cursor);
    setHasNext(pageInfo.has_next);
  };

  const fetchFirstPage = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setIsLoadingMore(false);
    loadingMoreRef.current = false;
    clearError();
    setReservations([]);
    setCursor(null);
    setHasNext(false);

    try {
      const response = await fetchReservationPage({
        filterType,
        size: RESERVATION_PAGE_SIZE,
      });

      if (requestIdRef.current !== requestId) return;

      setReservations(response.reservations);
      applyPageInfo(response.page_info);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;

      handleError(err);
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [clearError, fetchReservationPage, filterType, handleError]);

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  const loadMore = useCallback(async () => {
    if (!hasNext || isLoadingMore || loadingMoreRef.current || !cursor) return;

    const requestId = requestIdRef.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    clearError();

    try {
      const response = await fetchReservationPage({
        cursor,
        filterType,
        size: RESERVATION_PAGE_SIZE,
      });

      if (requestIdRef.current !== requestId) return;

      setReservations((prev) => [...prev, ...response.reservations]);
      applyPageInfo(response.page_info);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;

      handleError(err);
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  }, [
    clearError,
    cursor,
    fetchReservationPage,
    filterType,
    handleError,
    hasNext,
    isLoadingMore,
  ]);

  return {
    clearError,
    error,
    hasNext,
    isLoading,
    isLoadingMore,
    loadMore,
    reservations,
  };
}
