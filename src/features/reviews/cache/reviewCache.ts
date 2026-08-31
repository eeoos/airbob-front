import type { QueryClient, QueryFilters } from "@tanstack/react-query";
import {
  matchesSessionQueryScope,
  type SessionQueryScope,
} from "../../../platform/query/sessionScope";
import type { ReviewCachePort } from "../ports/reviewCachePort";
import { reviewReadQueryKeys } from "../queries/queryKeys";

type QueryPredicate = NonNullable<QueryFilters["predicate"]>;

const accommodationReviewsPredicate =
  (scope: SessionQueryScope): QueryPredicate =>
  (query) =>
    matchesSessionQueryScope(query.meta, scope);

export const createReviewCache = (
  queryClient: QueryClient,
): ReviewCachePort => ({
  reviewCreated({ accommodationId, scope }) {
    return queryClient.invalidateQueries(
      {
        queryKey: reviewReadQueryKeys.accommodationRoot(accommodationId),
        predicate: accommodationReviewsPredicate(scope),
      },
      { throwOnError: true },
    );
  },
});
