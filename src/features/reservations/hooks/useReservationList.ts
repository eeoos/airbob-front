import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { reservationApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { CursorPageInfo } from "../../../types/api";
import { ReservationFilterType } from "../../../types/reservation";
import { reservationQueryKeys } from "../queryKeys";

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

type ReservationListQueryScope = "guest" | "host" | `custom:${string}`;
type CustomReservationListScope = string;

let customReservationListScopeCounter = 0;

const toCustomReservationListQueryScope = (
  scope: CustomReservationListScope,
): ReservationListQueryScope => `custom:${scope}`;

const getReservationListQueryScope = <TReservation,>(
  fetchReservationPage: FetchReservationPage<TReservation>,
  explicitScope: CustomReservationListScope | undefined,
  fallbackCustomScope: CustomReservationListScope,
): ReservationListQueryScope => {
  if (fetchReservationPage === reservationApi.getMyReservations) {
    return "guest";
  }

  if (fetchReservationPage === reservationApi.getHostReservations) {
    return "host";
  }

  return toCustomReservationListQueryScope(
    explicitScope ?? fallbackCustomScope,
  );
};

const getReservationListParamsSignature = (
  filterType: ReservationFilterType,
  cursor?: string,
) => {
  const params = new URLSearchParams();
  params.set("filterType", filterType);
  params.set("size", RESERVATION_PAGE_SIZE.toString());

  if (cursor) {
    params.set("cursor", cursor);
  }

  return params.toString();
};

const getReservationListQueryKey = (
  scope: ReservationListQueryScope,
  filterType: ReservationFilterType,
  cursor?: string,
) => {
  const paramsSignature = getReservationListParamsSignature(filterType, cursor);

  if (scope === "host") {
    return reservationQueryKeys.hostReservations(paramsSignature);
  }

  if (scope === "guest") {
    return reservationQueryKeys.guestReservations(paramsSignature);
  }

  return [
    ...reservationQueryKeys.all,
    "custom",
    scope.slice("custom:".length),
    paramsSignature,
  ] as const;
};

export function useReservationList<TReservation>(
  filterType: ReservationFilterType,
  fetchReservationPage: FetchReservationPage<TReservation>,
  scope?: CustomReservationListScope,
) {
  const queryClient = useQueryClient();
  const { error, handleError, clearError } = useApiError();
  const [reservations, setReservations] = useState<TReservation[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const requestGenerationRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const handledErrorUpdatedAtRef = useRef(0);
  const customQueryScopeRef = useRef<{
    fetchReservationPage: FetchReservationPage<TReservation>;
    scope: CustomReservationListScope;
  } | null>(null);

  if (
    !customQueryScopeRef.current ||
    customQueryScopeRef.current.fetchReservationPage !== fetchReservationPage
  ) {
    customQueryScopeRef.current = {
      fetchReservationPage,
      scope: `custom-${customReservationListScopeCounter}`,
    };
    customReservationListScopeCounter += 1;
  }

  const fallbackCustomScope = customQueryScopeRef.current.scope;
  const queryScope = useMemo(
    () =>
      getReservationListQueryScope(
        fetchReservationPage,
        scope,
        fallbackCustomScope,
      ),
    [fallbackCustomScope, fetchReservationPage, scope],
  );
  const firstPageQueryKey = useMemo(
    () => getReservationListQueryKey(queryScope, filterType),
    [filterType, queryScope],
  );

  const applyPageInfo = (pageInfo: CursorPageInfo) => {
    setCursor(pageInfo.next_cursor);
    setHasNext(pageInfo.has_next);
  };

  const firstPageQuery = useQuery<ReservationPage<TReservation>, unknown>({
    queryKey: firstPageQueryKey,
    queryFn: () => {
      clearError();
      return fetchReservationPage({
        filterType,
        size: RESERVATION_PAGE_SIZE,
      });
    },
    enabled: Boolean(filterType),
    retry: false,
    throwOnError: false,
  });

  useEffect(() => {
    requestGenerationRef.current += 1;
    setIsLoadingMore(false);
    loadingMoreRef.current = false;
    setReservations([]);
    setCursor(null);
    setHasNext(false);
  }, [fetchReservationPage, filterType, queryScope]);

  useEffect(() => {
    if (!firstPageQuery.data) {
      return;
    }

    setReservations(firstPageQuery.data.reservations);
    applyPageInfo(firstPageQuery.data.page_info);
  }, [firstPageQuery.data, firstPageQuery.dataUpdatedAt]);

  useEffect(() => {
    if (
      !firstPageQuery.isError ||
      !firstPageQuery.error ||
      handledErrorUpdatedAtRef.current === firstPageQuery.errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current = firstPageQuery.errorUpdatedAt;
    handleError(firstPageQuery.error);
  }, [
    firstPageQuery.error,
    firstPageQuery.errorUpdatedAt,
    firstPageQuery.isError,
    handleError,
  ]);

  const loadMore = useCallback(async () => {
    if (!hasNext || isLoadingMore || loadingMoreRef.current || !cursor) return;

    const requestGeneration = requestGenerationRef.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    clearError();

    try {
      const response = await queryClient.fetchQuery({
        queryKey: getReservationListQueryKey(queryScope, filterType, cursor),
        queryFn: () =>
          fetchReservationPage({
            cursor,
            filterType,
            size: RESERVATION_PAGE_SIZE,
          }),
      });

      if (requestGenerationRef.current !== requestGeneration) return;

      setReservations((prev) => [...prev, ...response.reservations]);
      applyPageInfo(response.page_info);
    } catch (err) {
      if (requestGenerationRef.current !== requestGeneration) return;

      handleError(err);
    } finally {
      if (requestGenerationRef.current === requestGeneration) {
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
    queryClient,
    queryScope,
  ]);

  return {
    clearError,
    error,
    hasNext,
    isLoading:
      firstPageQuery.isLoading ||
      (firstPageQuery.isFetching && reservations.length === 0),
    isLoadingMore,
    loadMore,
    reservations,
  };
}
