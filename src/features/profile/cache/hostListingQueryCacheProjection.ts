import type { QueryClient, QueryFilters } from "@tanstack/react-query";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { matchesSessionQueryScope } from "../../../platform/query/sessionScope";
import type { HostListingCacheProjectionPort } from "../ports/hostListingCacheProjectionPort";
import { hostListingQueryKeys } from "../queries/hostListingQueryKeys";

type QueryPredicate = NonNullable<QueryFilters["predicate"]>;

const scopedHostListingPredicate = (
  scope: AuthenticatedSessionScope,
): QueryPredicate =>
  (query) =>
    query.queryKey[0] === hostListingQueryKeys.root[0] &&
    query.queryKey[1] === hostListingQueryKeys.root[1] &&
    matchesSessionQueryScope(query.meta, scope);

export const createHostListingQueryCacheProjection = (
  queryClient: QueryClient,
): HostListingCacheProjectionPort => ({
  async refreshRequired({ scope }) {
    await queryClient.invalidateQueries({
      predicate: scopedHostListingPredicate(scope),
    }, { throwOnError: true });
  },
});
