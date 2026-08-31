import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  createSessionQueryMeta,
  type SessionQueryScope,
} from "../../../platform/query/sessionScope";
import { reviewApi as defaultReviewApi } from "../api/reviewApi";
import type { ReviewPage } from "../model";
import type { ReviewReadApiPort } from "../ports/reviewApiPort";
import { reviewReadQueryKeys } from "./queryKeys";

const REVIEW_PAGE_SIZE = 6;
const REVIEW_LIST_SORT_TYPE = "LATEST" as const;

export interface AccommodationReviewsQueryOptions {
  readonly accommodationId: number | null;
  readonly scope: SessionQueryScope;
  readonly enabled?: boolean;
}

const getNextReviewCursor = (
  page: ReviewPage,
  _allPages: ReviewPage[],
  _lastPageParam: string | null,
  allPageParams: (string | null)[],
) => {
  const nextCursor = page.pageInfo.hasNext
    ? (page.pageInfo.nextCursor ?? undefined)
    : undefined;

  return nextCursor !== undefined && !allPageParams.includes(nextCursor)
    ? nextCursor
    : undefined;
};

const createAccommodationReviewsQueryOptions = (
  { accommodationId, scope, enabled = true }: AccommodationReviewsQueryOptions,
  api: ReviewReadApiPort = defaultReviewApi,
) => ({
  queryKey: reviewReadQueryKeys.accommodation(
    scope,
    accommodationId,
    REVIEW_LIST_SORT_TYPE,
    REVIEW_PAGE_SIZE,
  ),
  queryFn: ({
    pageParam,
    signal,
  }: {
    readonly pageParam: string | null;
    readonly signal: AbortSignal;
  }) => {
    if (accommodationId === null) {
      throw new TypeError("accommodationId is required for a review query.");
    }

    return api.getReviews(
      accommodationId,
      {
        ...(pageParam ? { cursor: pageParam } : {}),
        size: REVIEW_PAGE_SIZE,
        sortType: REVIEW_LIST_SORT_TYPE,
      },
      { signal },
    );
  },
  initialPageParam: null as string | null,
  getNextPageParam: getNextReviewCursor,
  enabled: enabled && accommodationId !== null,
  meta: createSessionQueryMeta(scope),
  throwOnError: false as const,
});

export const useAccommodationReviewsReadQuery = (
  options: AccommodationReviewsQueryOptions,
) =>
  useInfiniteQuery<
    ReviewPage,
    Error,
    InfiniteData<ReviewPage, string | null>,
    ReturnType<typeof reviewReadQueryKeys.accommodation>,
    string | null
  >(createAccommodationReviewsQueryOptions(options));
