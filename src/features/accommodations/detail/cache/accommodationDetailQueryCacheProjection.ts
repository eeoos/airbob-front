import type { QueryClient, QueryFilters } from "@tanstack/react-query";
import type { SessionQueryScope } from "../../../../platform/query/sessionScope";
import type { AccommodationDetail } from "../model/accommodationDetail";
import type { AccommodationDetailCacheProjectionPort } from "../ports/accommodationDetailCacheProjectionPort";
import { accommodationReadQueryKeys } from "../queries/queryKeys";

type QueryPredicate = NonNullable<QueryFilters["predicate"]>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasSessionScope = (
  meta: unknown,
  scope: SessionQueryScope,
): boolean => {
  if (!isRecord(meta) || !isRecord(meta.session)) return false;

  return (
    meta.session.subject === scope.subject &&
    meta.session.epoch === scope.epoch
  );
};

const exactScopedDetailPredicate = (
  scope: SessionQueryScope,
  accommodationId: number,
): QueryPredicate =>
  (query) =>
    query.queryKey[0] === accommodationReadQueryKeys.detailRoot[0] &&
    query.queryKey[1] === accommodationReadQueryKeys.detailRoot[1] &&
    query.queryKey[2] === accommodationId &&
    hasSessionScope(query.meta, scope);

const scopedDetailPredicate = (scope: SessionQueryScope): QueryPredicate =>
  (query) =>
    query.queryKey[0] === accommodationReadQueryKeys.detailRoot[0] &&
    query.queryKey[1] === accommodationReadQueryKeys.detailRoot[1] &&
    hasSessionScope(query.meta, scope);

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
    void queryClient.invalidateQueries({
      predicate: exactScopedDetailPredicate(scope, accommodationId),
    });
  },

  membershipReconciled({
    scope,
    accommodationId,
    isInAnyWishlist,
  }) {
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
