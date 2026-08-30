import type { QueryClient, QueryFilters } from "@tanstack/react-query";
import type { SessionQueryScope } from "../../../platform/query/sessionScope";
import type { ReviewCachePort } from "../ports/reviewCachePort";
import { reviewReadQueryKeys } from "../queries/queryKeys";

type QueryPredicate = NonNullable<QueryFilters["predicate"]>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasSessionScope = (
  meta: unknown,
  scope: SessionQueryScope,
): boolean =>
  isRecord(meta) &&
  isRecord(meta.session) &&
  meta.session.subject === scope.subject &&
  meta.session.epoch === scope.epoch;

const accommodationReviewsPredicate = (
  scope: SessionQueryScope,
): QueryPredicate =>
  (query) => hasSessionScope(query.meta, scope);

export const createReviewCache = (
  queryClient: QueryClient,
): ReviewCachePort => ({
  reviewCreated({ accommodationId, scope }) {
    return queryClient.invalidateQueries({
      queryKey: reviewReadQueryKeys.accommodationRoot(accommodationId),
      predicate: accommodationReviewsPredicate(scope),
    });
  },
});
