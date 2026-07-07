import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { reservationApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { useHandledQueryError } from "../../../query/useHandledQueryError";
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
) => {
  const params = new URLSearchParams();
  params.set("filterType", filterType);
  params.set("size", RESERVATION_PAGE_SIZE.toString());

  return params.toString();
};

const getReservationListQueryKey = (
  scope: ReservationListQueryScope,
  filterType: ReservationFilterType,
) => {
  const paramsSignature = getReservationListParamsSignature(filterType);

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
  const { error, handleError, clearError } = useApiError();
  const fallbackCustomScopeRef = useRef<CustomReservationListScope | null>(null);

  if (fallbackCustomScopeRef.current === null) {
    fallbackCustomScopeRef.current = `custom-${customReservationListScopeCounter}`;
    customReservationListScopeCounter += 1;
  }

  const fallbackCustomScope = fallbackCustomScopeRef.current;
  const queryScope = useMemo(
    () =>
      getReservationListQueryScope(
        fetchReservationPage,
        scope,
        fallbackCustomScope,
      ),
    [fallbackCustomScope, fetchReservationPage, scope],
  );
  const reservationListQueryKey = useMemo(
    () => getReservationListQueryKey(queryScope, filterType),
    [filterType, queryScope],
  );

  const reservationListQuery = useInfiniteQuery({
    queryKey: reservationListQueryKey,
    queryFn: ({ pageParam }: { pageParam?: string }) => {
      clearError();
      return fetchReservationPage({
        cursor: pageParam,
        filterType,
        size: RESERVATION_PAGE_SIZE,
      });
    },
    enabled: Boolean(filterType),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ReservationPage<TReservation>) =>
      lastPage.page_info.has_next
        ? lastPage.page_info.next_cursor ?? undefined
        : undefined,
    retry: false,
    throwOnError: false,
  });

  const reservations = useMemo(
    () =>
      reservationListQuery.data?.pages.flatMap(
        (page) => page.reservations,
      ) ?? [],
    [reservationListQuery.data],
  );

  useHandledQueryError({
    error: reservationListQuery.error,
    errorUpdatedAt: reservationListQuery.errorUpdatedAt,
    isError: reservationListQuery.isError,
    onError: handleError,
  });

  const loadMore = useCallback(async () => {
    if (
      !reservationListQuery.hasNextPage ||
      reservationListQuery.isFetchingNextPage
    ) {
      return;
    }

    await reservationListQuery.fetchNextPage({ cancelRefetch: false });
  }, [reservationListQuery]);

  return {
    clearError,
    error,
    hasNext: Boolean(reservationListQuery.hasNextPage),
    isLoading:
      reservationListQuery.isLoading ||
      (reservationListQuery.isFetching && reservations.length === 0),
    isLoadingMore: reservationListQuery.isFetchingNextPage,
    loadMore,
    reservations,
  };
}
