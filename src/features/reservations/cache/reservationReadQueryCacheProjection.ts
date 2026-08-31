import type { QueryClient, QueryFilters } from "@tanstack/react-query";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { matchesSessionQueryScope } from "../../../platform/query/sessionScope";
import type { ReservationReadCacheProjectionPort } from "../ports/reservationReadCacheProjectionPort";
import { reservationReadQueryKeys } from "../queries/reservationReadQueryKeys";

type QueryPredicate = NonNullable<QueryFilters["predicate"]>;

const isGuestReadForScope =
  (scope: AuthenticatedSessionScope, reservationUid: string): QueryPredicate =>
  (query) => {
    if (!matchesSessionQueryScope(query.meta, scope)) return false;

    const key = query.queryKey;
    const isGuestList =
      key[0] === reservationReadQueryKeys.listRoot[0] &&
      key[1] === reservationReadQueryKeys.listRoot[1] &&
      key[2] === reservationReadQueryKeys.listRoot[2] &&
      key[3] === "guest";
    const isGuestDetail =
      key[0] === reservationReadQueryKeys.detailRoot[0] &&
      key[1] === reservationReadQueryKeys.detailRoot[1] &&
      key[2] === reservationReadQueryKeys.detailRoot[2] &&
      key[3] === "guest" &&
      key[4] === reservationUid;

    return isGuestList || isGuestDetail;
  };

export const createReservationReadQueryCacheProjection = (
  queryClient: QueryClient,
): ReservationReadCacheProjectionPort => ({
  async guestReservationChanged({ reservationUid, scope }) {
    await queryClient.invalidateQueries(
      {
        predicate: isGuestReadForScope(scope, reservationUid),
      },
      { throwOnError: true },
    );
  },
});
