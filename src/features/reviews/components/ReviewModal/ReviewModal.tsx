import { useCallback, useMemo, useRef, useState } from "react";
import { useIntersectionLoadMore } from "../../../../shared/lib/useIntersectionLoadMore";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import {
  Button,
  Dialog,
  EmptyState,
  ImageWithFallback,
  RetryableErrorState,
  Skeleton,
  useNonModalOverlayRegistration,
  useOutsideClick,
} from "../../../../shared/ui";
import type { ReviewViewModel } from "../../lib/reviewViewModel";
import type { ReviewSortType } from "../../model";
import styles from "./ReviewModal.module.css";

type ReviewModalStatus = "empty" | "error" | "loading" | "ready";

const REVIEW_SORT_TYPE = {
  LATEST: "LATEST",
  HIGHEST_RATING: "HIGHEST_RATING",
  LOWEST_RATING: "LOWEST_RATING",
} as const satisfies Record<ReviewSortType, ReviewSortType>;

interface ReviewModalProps {
  readonly averageRating: number;
  readonly errorMessage: string | null;
  readonly hasNext: boolean;
  readonly isFetching: boolean;
  readonly isOpen: boolean;
  readonly isRetrying: boolean;
  readonly loadMoreErrorMessage: string | null;
  readonly onClose: () => void;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
  readonly onRetryLoadMore: () => void;
  readonly reviews: readonly ReviewViewModel[];
  readonly status: ReviewModalStatus;
  readonly totalCount: number;
}

const getSortLabel = (type: ReviewSortType): string => {
  switch (type) {
    case REVIEW_SORT_TYPE.LATEST:
      return "최신순";
    case REVIEW_SORT_TYPE.HIGHEST_RATING:
      return "높은 평점순";
    case REVIEW_SORT_TYPE.LOWEST_RATING:
      return "낮은 평점순";
  }
};

const ReviewRating = ({ rating }: { readonly rating: number }) => (
  <div
    aria-label={`5점 만점에 ${rating}점`}
    className={styles.reviewRating}
    role="img"
  >
    {Array.from({ length: 5 }).map((_, index) => (
      <svg
        key={index}
        aria-hidden="true"
        className={index < rating ? styles.starIconFilled : styles.starIcon}
        viewBox="0 0 24 24"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
  </div>
);

const ReviewImageFallback = () => (
  <span
    aria-label="후기 이미지 없음"
    className={styles.reviewImageFallback}
    role="img"
  >
    이미지를 불러올 수 없어요
  </span>
);

export function ReviewModal({
  averageRating,
  errorMessage,
  hasNext,
  isFetching,
  isOpen,
  isRetrying,
  loadMoreErrorMessage,
  onClose,
  onLoadMore,
  onRetry,
  onRetryLoadMore,
  reviews,
  status,
  totalCount,
}: ReviewModalProps) {
  const [sortType, setSortType] = useState<ReviewSortType>(
    REVIEW_SORT_TYPE.LATEST,
  );
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortContainerRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeSortDropdown = useCallback(() => setIsSortDropdownOpen(false), []);
  const sortOverlay = useNonModalOverlayRegistration({
    enabled: isOpen && isSortDropdownOpen,
    onClose: closeSortDropdown,
    overlayRef: sortDropdownRef,
    triggerRef: sortTriggerRef,
  });

  useOutsideClick(sortContainerRef, closeSortDropdown, isSortDropdownOpen);
  const loadMoreSentinelRef = useIntersectionLoadMore({
    disabled: !isOpen || status !== "ready" || loadMoreErrorMessage !== null,
    hasNext,
    isLoading: isFetching,
    onLoadMore,
    threshold: 0,
  });
  const sortedReviews = useMemo(
    () =>
      [...reviews].sort((a, b) => {
        switch (sortType) {
          case REVIEW_SORT_TYPE.LATEST:
            return b.date.timestamp - a.date.timestamp;
          case REVIEW_SORT_TYPE.HIGHEST_RATING:
            return b.rating - a.rating;
          case REVIEW_SORT_TYPE.LOWEST_RATING:
            return a.rating - b.rating;
        }
      }),
    [reviews, sortType],
  );

  if (!isOpen) return null;

  return (
    <Dialog
      bodyClassName={requireCssModuleClass(styles.modalContent)}
      bodyPadding="none"
      className={requireCssModuleClass(styles.dialog)}
      initialFocusRef={closeButtonRef}
      isOpen={isOpen}
      onClose={onClose}
      showHeader={false}
      size="xl"
      title={`후기 ${totalCount}개`}
    >
      <button
        ref={closeButtonRef}
        aria-label="후기 모달 닫기"
        className={styles.closeButton}
        type="button"
        onClick={onClose}
      >
        <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>

      <header className={styles.modalHeader}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>여행 기록</span>
          <h2
            aria-label={`평점 ${averageRating.toFixed(2)} · 후기 ${totalCount}개`}
            className={styles.headerTitle}
          >
            <span aria-hidden="true">★</span> {averageRating.toFixed(2)} · 후기{" "}
            {totalCount}개
          </h2>
          {status === "ready" && (
            <p className={styles.sortDisclosure}>
              현재 불러온 후기 {reviews.length}개 안에서 정렬합니다.
            </p>
          )}
        </div>

        {status === "ready" && reviews.length > 1 && (
          <div className={styles.sortContainer} ref={sortContainerRef}>
            <button
              ref={sortTriggerRef}
              aria-controls="review-sort-options"
              aria-expanded={isSortDropdownOpen}
              className={styles.sortButton}
              type="button"
              onClick={() => setIsSortDropdownOpen((current) => !current)}
            >
              {getSortLabel(sortType)}
              <svg
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {isSortDropdownOpen && (
              <div
                ref={sortDropdownRef}
                aria-label="불러온 후기 정렬 옵션"
                className={styles.sortDropdown}
                id="review-sort-options"
                role="group"
                onKeyDownCapture={sortOverlay.onKeyDown}
              >
                {(
                  [
                    REVIEW_SORT_TYPE.LATEST,
                    REVIEW_SORT_TYPE.HIGHEST_RATING,
                    REVIEW_SORT_TYPE.LOWEST_RATING,
                  ] as const
                ).map((type) => (
                  <button
                    key={type}
                    aria-pressed={sortType === type}
                    className={
                      sortType === type
                        ? styles.sortOptionActive
                        : styles.sortOption
                    }
                    type="button"
                    onClick={() => {
                      setSortType(type);
                      setIsSortDropdownOpen(false);
                    }}
                  >
                    {getSortLabel(type)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {status === "loading" && (
        <div
          aria-label="후기 불러오는 중"
          className={styles.loadingList}
          role="status"
        >
          <span className={styles.screenReaderOnly}>
            여행 기록을 불러오는 중입니다.
          </span>
          {[0, 1, 2].map((item) => (
            <div key={item} className={styles.loadingItem}>
              <div className={styles.loadingAuthor}>
                <Skeleton className={styles.loadingAvatar} />
                <Skeleton className={styles.loadingName} />
              </div>
              <Skeleton className={styles.loadingMeta} />
              <Skeleton className={styles.loadingLine} />
              <Skeleton className={styles.loadingLineShort} />
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <RetryableErrorState
          className={styles.modalState}
          title="여행 기록을 불러오지 못했어요"
          description={errorMessage ?? "잠시 후 다시 시도해 주세요."}
          action={
            <Button
              isLoading={isRetrying}
              loadingLabel="다시 불러오는 중..."
              type="button"
              onClick={onRetry}
            >
              다시 시도
            </Button>
          }
        />
      )}

      {status === "empty" && (
        <EmptyState
          className={styles.modalState}
          title={
            totalCount > 0
              ? "표시할 수 있는 여행 기록이 없어요"
              : "아직 등록된 여행 기록이 없어요"
          }
          description={
            totalCount > 0
              ? "후기 목록이 갱신되면 이곳에서 확인할 수 있어요."
              : "숙박을 마친 게스트의 후기가 등록되면 이곳에서 확인할 수 있어요."
          }
        />
      )}

      {status === "ready" && (
        <div className={styles.reviewsList}>
          {sortedReviews.map((review) => (
            <article key={review.id} className={styles.reviewItem}>
              <div className={styles.reviewerInfo}>
                <ImageWithFallback
                  alt={`${review.author.name} 프로필`}
                  className={styles.reviewerAvatar}
                  fallback={
                    <span
                      aria-label={`${review.author.name} 프로필 이미지 없음`}
                      className={styles.reviewerAvatarPlaceholder}
                      role="img"
                    >
                      {review.author.avatarInitial}
                    </span>
                  }
                  src={review.author.avatarUrl}
                />
                <div className={styles.reviewerDetails}>
                  <span className={styles.reviewerName}>
                    {review.author.name}
                  </span>
                  <time
                    className={styles.reviewDate}
                    dateTime={review.date.iso}
                  >
                    {review.date.label}
                  </time>
                </div>
              </div>

              <ReviewRating rating={review.rating} />
              <p className={styles.reviewContent}>{review.content}</p>

              {review.images.length > 0 && (
                <div
                  aria-label={`${review.author.name}님의 후기 사진`}
                  className={styles.reviewImages}
                >
                  {review.images.map((image) => (
                    <ImageWithFallback
                      key={image.id}
                      alt={image.alt}
                      className={styles.reviewImage}
                      fallback={<ReviewImageFallback />}
                      src={image.url}
                    />
                  ))}
                </div>
              )}
            </article>
          ))}

          <div
            className={styles.loadMoreSentinel}
            data-testid="review-load-more-sentinel"
            ref={loadMoreSentinelRef}
          >
            {isFetching && (
              <span className={styles.loadingMore} role="status">
                후기 더 불러오는 중...
              </span>
            )}
            {loadMoreErrorMessage && (
              <div className={styles.loadMoreError} role="alert">
                <span>{loadMoreErrorMessage}</span>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={onRetryLoadMore}
                >
                  이어서 다시 불러오기
                </Button>
              </div>
            )}
            {!hasNext && !isFetching && loadMoreErrorMessage === null && (
              <span className={styles.endOfList}>
                불러온 여행 기록을 모두 확인했어요.
              </span>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
