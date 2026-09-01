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
  const [loadMoreErrorMessage, setLoadMoreErrorMessage] = useState<
    string | null
  >(null);
  const requestedPageRef = useRef<string | null>(null);
  const modalGenerationRef = useRef(0);
  const feedIdentity = `${accommodationId ?? "invalid"}:${scope.subject ?? "anonymous"}:${scope.epoch}`;
  const feedIdentityRef = useRef(feedIdentity);
  feedIdentityRef.current = feedIdentity;
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

  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    reviewsQuery;
  const nextCursor =
    reviewsQuery.data?.pages.at(-1)?.pageInfo.nextCursor ?? null;

  const loadNextReviewPage = useCallback(async () => {
    if (!isReviewModalOpen) return;
    if (!hasNextPage || isFetchingNextPage || nextCursor === null) return;

    const requestKey = `${feedIdentity}:${nextCursor}`;
    const requestGeneration = modalGenerationRef.current;
    if (requestedPageRef.current === requestKey) return;
    requestedPageRef.current = requestKey;

    try {
      await fetchNextPage({ cancelRefetch: false, throwOnError: true });
      if (
        requestedPageRef.current !== requestKey ||
        modalGenerationRef.current !== requestGeneration ||
        feedIdentityRef.current !== feedIdentity
      ) {
        return;
      }
      setLoadMoreErrorMessage(null);
    } catch (error) {
      if (
        requestedPageRef.current !== requestKey ||
        modalGenerationRef.current !== requestGeneration ||
        feedIdentityRef.current !== feedIdentity
      ) {
        return;
      }
      const message = toAccommodationErrorMessage(error);
      setLoadMoreErrorMessage(message);
      onError(message);
    }
  }, [
    feedIdentity,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isReviewModalOpen,
    nextCursor,
    onError,
  ]);

  const closeReviewModal = useCallback(() => {
    modalGenerationRef.current += 1;
    requestedPageRef.current = null;
    setLoadMoreErrorMessage(null);
    setIsReviewModalOpen(false);
  }, []);

  const openReviewModal = useCallback(() => {
    modalGenerationRef.current += 1;
    requestedPageRef.current = null;
    setLoadMoreErrorMessage(null);
    setIsReviewModalOpen(true);
  }, []);

  const retryReviewFeed = useCallback(() => {
    requestedPageRef.current = null;
    setLoadMoreErrorMessage(null);
    void refetch();
  }, [refetch]);

  const retryNextReviewPage = useCallback(() => {
    modalGenerationRef.current += 1;
    requestedPageRef.current = null;
    setLoadMoreErrorMessage(null);
    void loadNextReviewPage();
  }, [loadNextReviewPage]);

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
  const hasLoadedReviewPage = reviewPages.length > 0;
  const status: "empty" | "error" | "loading" | "ready" = !enabled
    ? "empty"
    : reviewsQuery.isLoading
      ? "loading"
      : reviewsQuery.isError && !hasLoadedReviewPage
        ? "error"
        : previewReviews.length > 0
          ? "ready"
          : "empty";

  return {
    allReviews,
    closeReviewModal,
    hasNextReviewPage: Boolean(hasNextPage && nextCursor !== null),
    isFetchingNextReviewPage: isFetchingNextPage,
    isReviewModalOpen,
    isRetryingReviewFeed: Boolean(
      reviewsQuery.isFetching && !reviewsQuery.isFetchingNextPage,
    ),
    loadNextReviewPage,
    loadMoreErrorMessage,
    openReviewModal,
    previewReviews,
    retryNextReviewPage,
    retryReviewFeed,
    reviewErrorMessage: reviewsQuery.isError
      ? toAccommodationErrorMessage(reviewsQuery.error)
      : null,
    status,
  };
};
