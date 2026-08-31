import type { QueryClient, QueryFilters } from "@tanstack/react-query";
import {
  matchesSessionQueryScope,
  type SessionQueryScope,
} from "../../../../platform/query/sessionScope";
import type { AccommodationDetail } from "../model/accommodationDetail";
import type { AccommodationDetailCacheProjectionPort } from "../ports/accommodationDetailCacheProjectionPort";
import { accommodationReadQueryKeys } from "../queries/queryKeys";

type QueryPredicate = NonNullable<QueryFilters["predicate"]>;

const exactScopedDetailPredicate =
  (scope: SessionQueryScope, accommodationId: number): QueryPredicate =>
  (query) =>
    query.queryKey[0] === accommodationReadQueryKeys.detailRoot[0] &&
    query.queryKey[1] === accommodationReadQueryKeys.detailRoot[1] &&
    query.queryKey[2] === accommodationId &&
    matchesSessionQueryScope(query.meta, scope);

const scopedDetailPredicate =
  (scope: SessionQueryScope): QueryPredicate =>
  (query) =>
    query.queryKey[0] === accommodationReadQueryKeys.detailRoot[0] &&
    query.queryKey[1] === accommodationReadQueryKeys.detailRoot[1] &&
    matchesSessionQueryScope(query.meta, scope);

const patchMembership = (
  detail: AccommodationDetail | undefined,
  accommodationId: number,
  isInWishlist: boolean,
): AccommodationDetail | undefined => {
  if (
    !detail ||
    detail.id !== accommodationId ||
    detail.isInWishlist === isInWishlist
  ) {
    return detail;
  }

  return { ...detail, isInWishlist };
};

export const createAccommodationDetailQueryCacheProjection = (
  queryClient: QueryClient,
): AccommodationDetailCacheProjectionPort => ({
  detailRefreshRequired({ scope, accommodationId }) {
    return queryClient.invalidateQueries(
      {
        predicate: exactScopedDetailPredicate(scope, accommodationId),
      },
      { throwOnError: true },
    );
  },

  membershipReconciled({ scope, accommodationId, isInAnyWishlist }) {
    queryClient.setQueriesData<AccommodationDetail>(
      { predicate: exactScopedDetailPredicate(scope, accommodationId) },
      (previous: AccommodationDetail | undefined) =>
        patchMembership(previous, accommodationId, isInAnyWishlist),
    );
  },

  membershipScopeRefreshRequired({ scope }) {
    void queryClient.invalidateQueries({
      predicate: scopedDetailPredicate(scope),
    });
  },

  membershipRefreshRequired({ scope, accommodationId }) {
    void queryClient.invalidateQueries({
      predicate: exactScopedDetailPredicate(scope, accommodationId),
    });
  },
});
