import { useCallback, useEffect, useRef, useState } from "react";
import { reviewApi } from "../../../api";
import { ReviewSortType } from "../../../types/enums";
import { ReviewInfo } from "../../../types/review";

interface UseAccommodationReviewsOptions {
  accommodationId?: string;
  totalReviewCount: number;
  handleError: (error: unknown) => unknown;
  clearError: () => void;
}

const REVIEW_PAGE_SIZE = 6;

export const useAccommodationReviews = ({
  accommodationId,
  totalReviewCount,
  handleError,
  clearError,
}: UseAccommodationReviewsOptions) => {
  const [reviews, setReviews] = useState<ReviewInfo[]>([]);
  const [allReviews, setAllReviews] = useState<ReviewInfo[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewCursor, setReviewCursor] = useState<string | null>(null);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const reviewObserverTarget = useRef<HTMLDivElement>(null);
  const [expandedReviews] = useState<Record<number, boolean>>({});

  const fetchReviews = useCallback(async (cursor?: string | null) => {
    if (!accommodationId) {
      return;
    }

    if (totalReviewCount === 0) {
      setReviews([]);
      setAllReviews([]);
      setReviewCursor(null);
      setHasMoreReviews(false);
      return;
    }

    setIsLoadingReviews(true);
    clearError();

    try {
      const response = await reviewApi.getReviews(Number(accommodationId), {
        sortType: ReviewSortType.LATEST,
        size: REVIEW_PAGE_SIZE,
        cursor: cursor || undefined,
      });

      const fetchedReviews = response.reviews || [];
      const pageInfo = response.page_info;

      if (cursor) {
        setAllReviews((prev) => [...prev, ...fetchedReviews]);
      } else {
        setReviews(fetchedReviews);
        setAllReviews(fetchedReviews);
      }

      setReviewCursor(pageInfo.next_cursor || null);
      setHasMoreReviews(pageInfo.has_next || false);
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoadingReviews(false);
    }
  }, [accommodationId, clearError, handleError, totalReviewCount]);

  useEffect(() => {
    if (accommodationId) {
      fetchReviews();
    }
  }, [accommodationId, fetchReviews]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMoreReviews &&
          !isLoadingReviews &&
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
  }, [fetchReviews, hasMoreReviews, isLoadingReviews, reviewCursor]);

  return {
    reviews,
    allReviews,
    isLoadingReviews,
    reviewCursor,
    hasMoreReviews,
    isReviewModalOpen,
    setIsReviewModalOpen,
    reviewObserverTarget,
    expandedReviews,
    fetchReviews,
  };
};
