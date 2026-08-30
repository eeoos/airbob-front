import type { QueryClient, QueryFilters } from "@tanstack/react-query";
import type { SessionQueryScope } from "../../../platform/query/sessionScope";
import type { SearchResultPage } from "../model/search";
import { searchReadQueryKeys } from "../queries/queryKeys";

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

const scopedSearchResultsPredicate = (
  scope: SessionQueryScope,
): QueryPredicate =>
  (query) =>
    query.queryKey[0] === searchReadQueryKeys.root[0] &&
    query.queryKey[1] === "results" &&
    hasSessionScope(query.meta, scope);

const patchMembership = (
  page: SearchResultPage | undefined,
  accommodationId: number,
  isInWishlist: boolean,
): SearchResultPage | undefined => {
  if (!page) return page;

  let didChange = false;
  const accommodations = page.accommodations.map((accommodation) => {
    if (
      accommodation.id !== accommodationId ||
      accommodation.isInWishlist === isInWishlist
    ) {
      return accommodation;
    }

    didChange = true;
    return { ...accommodation, isInWishlist };
  });

  return didChange ? { ...page, accommodations } : page;
};

export interface SearchMembershipProjection {
  membershipReconciled(input: {
    readonly scope: SessionQueryScope;
    readonly accommodationId: number;
    readonly isInWishlist: boolean;
  }): void;
  membershipRefreshRequired(input: {
    readonly scope: SessionQueryScope;
  }): void;
}

export const createSearchQueryCacheProjection = (
  queryClient: QueryClient,
): SearchMembershipProjection => ({
  membershipReconciled({ scope, accommodationId, isInWishlist }) {
    queryClient.setQueriesData<SearchResultPage>(
      { predicate: scopedSearchResultsPredicate(scope) },
      (previous: SearchResultPage | undefined) =>
        patchMembership(previous, accommodationId, isInWishlist),
    );
  },

  membershipRefreshRequired({ scope }) {
    void queryClient.invalidateQueries({
      predicate: scopedSearchResultsPredicate(scope),
    });
  },
});
