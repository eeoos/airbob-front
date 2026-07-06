import { useInfiniteQuery } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { reviewApi } from "../../../api";
import { useHandledQueryError } from "../../../query/useHandledQueryError";
import { ReviewSortType } from "../../../types/enums";
import { ReviewInfos } from "../../../types/review";
import { accommodationQueryKeys } from "../queryKeys";

interface UseAccommodationReviewsOptions {
  accommodationId?: string;
  totalReviewCount: number;
  handleError: (error: unknown) => unknown;
  clearError: () => void;
}

const REVIEW_PAGE_SIZE = 6;

const accommodationReviewsQueryKey = (
  accommodationId: string | undefined,
  cursor: string | null,
) =>
  accommodationQueryKeys.reviews({
    accommodationId: accommodationId ?? null,
    cursor,
    size: REVIEW_PAGE_SIZE,
    sortType: ReviewSortType.LATEST,
  });

export const useAccommodationReviews = ({
  accommodationId,
  totalReviewCount,
  handleError,
  clearError,
}: UseAccommodationReviewsOptions) => {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const reviewObserverTarget = useRef<HTMLDivElement>(null);
  const [expandedReviews] = useState<Record<number, boolean>>({});
  const shouldFetchReviews = Boolean(accommodationId) && totalReviewCount > 0;

  const reviewsQuery = useInfiniteQuery<
    ReviewInfos,
    unknown,
    InfiniteData<ReviewInfos, string | undefined>,
    ReturnType<typeof accommodationReviewsQueryKey>,
    string | undefined
  >({
    queryKey: accommodationReviewsQueryKey(accommodationId, null),
    queryFn: ({ pageParam }) => {
      if (!accommodationId) {
        throw new Error("accommodationId is required");
      }

      clearError();
      return reviewApi.getReviews(Number(accommodationId), {
        sortType: ReviewSortType.LATEST,
        size: REVIEW_PAGE_SIZE,
        cursor: pageParam,
      });
    },
    enabled: shouldFetchReviews,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.page_info.has_next
        ? lastPage.page_info.next_cursor ?? undefined
        : undefined,
    retry: false,
    throwOnError: false,
  });
  const {
    data: reviewsData,
    error: reviewsError,
    errorUpdatedAt,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetching,
    isFetchingNextPage,
    refetch,
  } = reviewsQuery;

  const reviewPages = useMemo(
    () => (shouldFetchReviews ? reviewsData?.pages ?? [] : []),
    [reviewsData, shouldFetchReviews],
  );
  const reviews = useMemo(
    () => reviewPages[0]?.reviews ?? [],
    [reviewPages],
  );
  const allReviews = useMemo(
    () => reviewPages.flatMap((page) => page.reviews ?? []),
    [reviewPages],
  );
  const latestPage = reviewPages[reviewPages.length - 1];
  const reviewCursor =
    hasNextPage && latestPage
      ? latestPage.page_info.next_cursor ?? null
      : null;
  const hasMoreReviews = shouldFetchReviews && Boolean(hasNextPage);
  const isLoadingMoreReviews = isFetchingNextPage;

  const fetchReviews = useCallback(async (cursor?: string | null) => {
    if (!shouldFetchReviews) {
      return;
    }

    if (!cursor) {
      clearError();
      await refetch();
      return;
    }

    if (
      cursor !== reviewCursor ||
      !hasNextPage ||
      isFetchingNextPage
    ) {
      return;
    }

    clearError();
    await fetchNextPage({ cancelRefetch: false });
  }, [
    clearError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    reviewCursor,
    shouldFetchReviews,
  ]);

  useHandledQueryError({
    error: reviewsError,
    errorUpdatedAt,
    isError,
    onError: handleError,
  });

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMoreReviews &&
          !isLoadingMoreReviews &&
          reviewCursor
        ) {
          fetchReviews(reviewCursor);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = reviewObserverTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [fetchReviews, hasMoreReviews, isLoadingMoreReviews, reviewCursor]);

  return {
    reviews,
    allReviews,
    isLoadingReviews: shouldFetchReviews && isFetching,
    reviewCursor,
    hasMoreReviews,
    isReviewModalOpen,
    setIsReviewModalOpen,
    reviewObserverTarget,
    expandedReviews,
    fetchReviews,
  };
};
