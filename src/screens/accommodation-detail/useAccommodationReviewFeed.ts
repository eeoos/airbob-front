import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccommodationDetailQueryOptions } from "../../features/accommodations/detail/public";
import {
  toReviewViewModels,
  useAccommodationReviewsReadQuery,
} from "../../features/reviews/public";
import { toAccommodationErrorMessage } from "./accommodationDetailErrors";

interface UseAccommodationReviewFeedOptions {
  readonly accommodationId: number | null;
  readonly enabled: boolean;
  readonly onError: (message: string) => void;
  readonly scope: AccommodationDetailQueryOptions["scope"];
}

export const useAccommodationReviewFeed = ({
  accommodationId,
  enabled,
  onError,
  scope,
}: UseAccommodationReviewFeedOptions) => {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const requestedPageRef = useRef<string | null>(null);
  const reviewsQuery = useAccommodationReviewsReadQuery({
    accommodationId,
    enabled,
    scope,
  });

  useEffect(() => {
    if (!reviewsQuery.isError) return;
    onError(toAccommodationErrorMessage(reviewsQuery.error));
  }, [
    onError,
    reviewsQuery.error,
    reviewsQuery.errorUpdatedAt,
    reviewsQuery.isError,
  ]);

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = reviewsQuery;
  const nextCursor =
    reviewsQuery.data?.pages.at(-1)?.pageInfo.nextCursor ?? null;

  const loadNextReviewPage = useCallback(async () => {
    if (!isReviewModalOpen) return;
    if (!hasNextPage || isFetchingNextPage || nextCursor === null) return;

    const requestKey = `${accommodationId ?? "invalid"}:${scope.subject ?? "anonymous"}:${scope.epoch}:${nextCursor}`;
    if (requestedPageRef.current === requestKey) return;
    requestedPageRef.current = requestKey;

    try {
      await fetchNextPage({ cancelRefetch: false });
    } catch (error) {
      onError(toAccommodationErrorMessage(error));
    }
  }, [
    accommodationId,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isReviewModalOpen,
    nextCursor,
    onError,
    scope.epoch,
    scope.subject,
  ]);

  const closeReviewModal = useCallback(() => {
    requestedPageRef.current = null;
    setIsReviewModalOpen(false);
  }, []);

  const openReviewModal = useCallback(() => {
    setIsReviewModalOpen(true);
  }, []);

  const reviewPages = useMemo(
    () => reviewsQuery.data?.pages ?? [],
    [reviewsQuery.data?.pages],
  );
  const previewReviews = useMemo(
    () => toReviewViewModels(reviewPages[0]?.reviews ?? []),
    [reviewPages],
  );
  const allReviews = useMemo(
    () => toReviewViewModels(reviewPages.flatMap((page) => page.reviews)),
    [reviewPages],
  );

  return {
    allReviews,
    closeReviewModal,
    hasNextReviewPage: Boolean(hasNextPage && nextCursor !== null),
    isFetchingNextReviewPage: isFetchingNextPage,
    isReviewModalOpen,
    loadNextReviewPage,
    openReviewModal,
    previewReviews,
  };
};
