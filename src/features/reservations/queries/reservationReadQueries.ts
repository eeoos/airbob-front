import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createSessionQueryMeta } from "../../../platform/query/sessionScope";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { reservationReadApi as defaultReservationReadApi } from "../api/reservationReadApi";
import type {
  GuestReservationDetail,
  HostReservationDetail,
  ReservationDetailByAudience,
  ReservationFilterType,
  ReservationListPage,
  ReservationReadAudience,
} from "../model/reservationRead";
import type { ReservationReadApiPort } from "../ports/reservationReadApiPort";
import { reservationReadQueryKeys } from "./reservationReadQueryKeys";

const RESERVATION_PAGE_SIZE = 20;

export interface ReservationListReadQueryOptions<
  TAudience extends ReservationReadAudience,
> {
  readonly audience: TAudience;
  readonly filterType: ReservationFilterType;
  readonly scope: AuthenticatedSessionScope | null;
  readonly pageSize?: number;
  readonly enabled?: boolean;
}

const createReservationListQueryOptions = <
  TAudience extends ReservationReadAudience,
>(
  {
    audience,
    enabled = true,
    filterType,
    pageSize = RESERVATION_PAGE_SIZE,
    scope,
  }: ReservationListReadQueryOptions<TAudience>,
  api: ReservationReadApiPort = defaultReservationReadApi,
) => ({
  queryKey: reservationReadQueryKeys.list(scope, audience, {
    filterType,
    size: pageSize,
  }),
  queryFn: ({
    pageParam,
    signal,
  }: {
    readonly pageParam: string | undefined;
    readonly signal: AbortSignal;
  }) => {
    if (scope === null) {
      throw new TypeError(
        "An authenticated session is required for a reservation list query.",
      );
    }

    return api.getList(
      audience,
      {
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
        filterType,
        size: pageSize,
      },
      { signal },
    );
  },
  enabled: enabled && scope !== null,
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage: ReservationListPage<TAudience>) =>
    lastPage.pageInfo.hasNext
      ? (lastPage.pageInfo.nextCursor ?? undefined)
      : undefined,
  ...(scope === null ? {} : { meta: createSessionQueryMeta(scope) }),
  retry: false as const,
  throwOnError: false as const,
});

export const useReservationListReadQuery = <
  TAudience extends ReservationReadAudience,
>(
  options: ReservationListReadQueryOptions<TAudience>,
  api: ReservationReadApiPort = defaultReservationReadApi,
) => useInfiniteQuery(createReservationListQueryOptions(options, api));

export interface ReservationDetailReadQueryOptions<
  TAudience extends ReservationReadAudience,
> {
  readonly audience: TAudience;
  readonly reservationUid: string | null;
  readonly scope: AuthenticatedSessionScope | null;
  readonly enabled?: boolean;
}

type ReservationDetail = GuestReservationDetail | HostReservationDetail;

const createReservationDetailQueryOptions = <
  TAudience extends ReservationReadAudience,
>(
  {
    audience,
    enabled = true,
    reservationUid,
    scope,
  }: ReservationDetailReadQueryOptions<TAudience>,
  api: ReservationReadApiPort = defaultReservationReadApi,
) => ({
  queryKey: reservationReadQueryKeys.detail(scope, audience, reservationUid),
  queryFn: ({ signal }: { readonly signal: AbortSignal }) => {
    if (reservationUid === null) {
      throw new TypeError(
        "reservationUid is required for a reservation detail query.",
      );
    }
    if (scope === null) {
      throw new TypeError(
        "An authenticated session is required for a reservation detail query.",
      );
    }

    return api.getDetail(audience, reservationUid, { signal });
  },
  enabled: enabled && reservationUid !== null && scope !== null,
  select: (
    resource: ReservationDetailByAudience<TAudience>,
  ): ReservationDetailByAudience<TAudience> | null => {
    const candidate = resource as ReservationDetail;
    return reservationUid !== null &&
      candidate.audience === audience &&
      candidate.reservationUid === reservationUid
      ? resource
      : null;
  },
  ...(scope === null ? {} : { meta: createSessionQueryMeta(scope) }),
  retry: false as const,
  throwOnError: false as const,
});

export const useReservationDetailReadQuery = <
  TAudience extends ReservationReadAudience,
>(
  options: ReservationDetailReadQueryOptions<TAudience>,
  api: ReservationReadApiPort = defaultReservationReadApi,
) =>
  useQuery<
    ReservationDetailByAudience<TAudience>,
    Error,
    ReservationDetailByAudience<TAudience> | null,
    ReturnType<typeof reservationReadQueryKeys.detail>
  >(createReservationDetailQueryOptions(options, api));
