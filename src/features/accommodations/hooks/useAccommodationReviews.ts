import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { reviewApi } from "../../../api";
import { ReviewSortType } from "../../../types/enums";
import { ReviewInfo, ReviewInfos } from "../../../types/review";

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
  [
    "accommodation",
    "reviews",
    accommodationId ?? "missing",
    ReviewSortType.LATEST,
    REVIEW_PAGE_SIZE,
    cursor ?? "first",
  ] as const;

export const useAccommodationReviews = ({
  accommodationId,
  totalReviewCount,
  handleError,
  clearError,
}: UseAccommodationReviewsOptions) => {
  const queryClient = useQueryClient();
  const [reviews, setReviews] = useState<ReviewInfo[]>([]);
  const [allReviews, setAllReviews] = useState<ReviewInfo[]>([]);
  const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false);
  const [reviewCursor, setReviewCursor] = useState<string | null>(null);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const reviewObserverTarget = useRef<HTMLDivElement>(null);
  const [expandedReviews] = useState<Record<number, boolean>>({});
  const handledErrorUpdatedAtRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const shouldFetchReviews = Boolean(accommodationId) && totalReviewCount > 0;

  const firstPageQuery = useQuery<
    ReviewInfos,
    unknown,
    ReviewInfos,
    ReturnType<typeof accommodationReviewsQueryKey>
  >({
    queryKey: accommodationReviewsQueryKey(accommodationId, null),
    queryFn: () => {
      if (!accommodationId) {
        throw new Error("accommodationId is required");
      }

      clearError();
      return reviewApi.getReviews(Number(accommodationId), {
        sortType: ReviewSortType.LATEST,
        size: REVIEW_PAGE_SIZE,
        cursor: undefined,
      });
    },
    enabled: shouldFetchReviews,
    retry: false,
    throwOnError: false,
  });

  const resetReviews = useCallback(() => {
    setReviews([]);
    setAllReviews([]);
    setReviewCursor(null);
    setHasMoreReviews(false);
  }, []);

  const applyFirstPage = useCallback((response: ReviewInfos) => {
    const fetchedReviews = response.reviews || [];
    const pageInfo = response.page_info;

    setReviews(fetchedReviews);
    setAllReviews(fetchedReviews);
    setReviewCursor(pageInfo.next_cursor || null);
    setHasMoreReviews(pageInfo.has_next || false);
  }, []);

  const appendReviewPage = useCallback((response: ReviewInfos) => {
    const fetchedReviews = response.reviews || [];
    const pageInfo = response.page_info;

    setAllReviews((prev) => [...prev, ...fetchedReviews]);
    setReviewCursor(pageInfo.next_cursor || null);
    setHasMoreReviews(pageInfo.has_next || false);
  }, []);

  const fetchReviews = useCallback(async (cursor?: string | null) => {
    if (!accommodationId) {
      return;
    }

    const requestGeneration = requestGenerationRef.current;

    if (totalReviewCount === 0) {
      resetReviews();
      return;
    }

    if (!cursor) {
      const result = await firstPageQuery.refetch();
      if (requestGenerationRef.current === requestGeneration && result.data) {
        applyFirstPage(result.data);
      }
      return;
    }

    setIsLoadingMoreReviews(true);
    clearError();

    try {
      const response = await queryClient.fetchQuery({
        queryKey: accommodationReviewsQueryKey(accommodationId, cursor),
        queryFn: () =>
          reviewApi.getReviews(Number(accommodationId), {
            sortType: ReviewSortType.LATEST,
            size: REVIEW_PAGE_SIZE,
            cursor,
          }),
      });

      if (requestGenerationRef.current !== requestGeneration) {
        return;
      }

      appendReviewPage(response);
    } catch (error) {
      if (requestGenerationRef.current !== requestGeneration) {
        return;
      }

      handleError(error);
    } finally {
      if (requestGenerationRef.current === requestGeneration) {
        setIsLoadingMoreReviews(false);
      }
    }
  }, [
    accommodationId,
    appendReviewPage,
    applyFirstPage,
    clearError,
    firstPageQuery,
    handleError,
    queryClient,
    resetReviews,
    totalReviewCount,
  ]);

  useEffect(() => {
    requestGenerationRef.current += 1;
    setIsLoadingMoreReviews(false);
    resetReviews();
  }, [accommodationId, resetReviews]);

  useEffect(() => {
    if (!shouldFetchReviews) {
      requestGenerationRef.current += 1;
      setIsLoadingMoreReviews(false);
      resetReviews();
    }
  }, [resetReviews, shouldFetchReviews]);

  useEffect(() => {
    if (!firstPageQuery.data) {
      return;
    }

    applyFirstPage(firstPageQuery.data);
  }, [applyFirstPage, firstPageQuery.data, firstPageQuery.dataUpdatedAt]);

  useEffect(() => {
    if (
      !firstPageQuery.isError ||
      !firstPageQuery.error ||
      handledErrorUpdatedAtRef.current === firstPageQuery.errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current = firstPageQuery.errorUpdatedAt;
    handleError(firstPageQuery.error);
  }, [
    firstPageQuery.error,
    firstPageQuery.errorUpdatedAt,
    firstPageQuery.isError,
    handleError,
  ]);

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
    isLoadingReviews: firstPageQuery.isFetching || isLoadingMoreReviews,
    reviewCursor,
    hasMoreReviews,
    isReviewModalOpen,
    setIsReviewModalOpen,
    reviewObserverTarget,
    expandedReviews,
    fetchReviews,
  };
};
