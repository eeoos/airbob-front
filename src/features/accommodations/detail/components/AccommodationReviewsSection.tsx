import {
  Button,
  EmptyState,
  ImageWithFallback,
  RetryableErrorState,
  Skeleton,
} from "../../../../shared/ui";
import type { AccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
import styles from "./AccommodationReviewsSection.module.css";

interface AccommodationReviewDisplay {
  readonly id: number;
  readonly rating: number;
  readonly author: {
    readonly name: string;
    readonly avatarUrl: string;
    readonly avatarInitial: string;
  };
  readonly date: {
    readonly label: string;
  };
  readonly content: string;
  readonly images: ReadonlyArray<{
    readonly id: number;
    readonly url: string;
    readonly alt: string;
  }>;
}

type ReviewFeedStatus = "empty" | "error" | "loading" | "ready";

interface AccommodationReviewsSectionProps {
  readonly errorMessage: string | null;
  readonly expandedReviews: Record<number, boolean>;
  readonly isRetrying: boolean;
  readonly maxReviewContentLength?: number;
  readonly onOpenReviews: () => void;
  readonly onRetry: () => void;
  readonly reviews: readonly AccommodationReviewDisplay[];
  readonly reviewSummary: AccommodationDetailViewModel["rating"];
  readonly status: ReviewFeedStatus;
}

const DEFAULT_MAX_REVIEW_CONTENT_LENGTH = 150;

const Rating = ({ rating }: { readonly rating: number }) => (
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

const AvatarFallback = ({
  initial,
  name,
}: {
  readonly initial: string;
  readonly name: string;
}) => (
  <span
    aria-label={`${name} 프로필 이미지 없음`}
    className={styles.reviewerAvatarPlaceholder}
    role="img"
  >
    {initial}
  </span>
);

const ReviewImageFallback = () => (
  <span
    aria-label="후기 이미지 없음"
    className={styles.reviewImageFallback}
    role="img"
  >
    <span aria-hidden="true" className={styles.imageFallbackIcon} />
    이미지를 불러올 수 없어요
  </span>
);

export function AccommodationReviewsSection({
  errorMessage,
  expandedReviews,
  isRetrying,
  maxReviewContentLength = DEFAULT_MAX_REVIEW_CONTENT_LENGTH,
  onOpenReviews,
  onRetry,
  reviews,
  reviewSummary,
  status,
}: AccommodationReviewsSectionProps) {
  return (
    <section
      aria-labelledby="accommodation-reviews-title"
      className={`${styles.section} ${styles.reviewSection}`}
    >
      <div className={styles.sectionHeading}>
        <h2
          aria-label={
            reviewSummary.hasReviews
              ? `평점 ${reviewSummary.averageRating.toFixed(2)} · 후기 ${reviewSummary.reviewCount}개`
              : "아직 등록된 후기가 없어요"
          }
          className={styles.sectionTitle}
          id="accommodation-reviews-title"
        >
          {reviewSummary.hasReviews ? (
            <>
              <span className={styles.desktopSummary}>
                <span aria-hidden="true">★</span>{" "}
                {reviewSummary.averageRating.toFixed(2)} · 후기{" "}
                {reviewSummary.reviewCount}개
              </span>
              <span className={styles.mobileSummary} aria-hidden="true">
                <strong>{reviewSummary.averageRating.toFixed(2)}</strong>
                <span>후기 {reviewSummary.reviewCount}개</span>
              </span>
            </>
          ) : (
            "아직 등록된 후기가 없어요"
          )}
        </h2>
        <p className={styles.sectionDescription}>
          실제로 머문 게스트가 남긴 경험을 확인해 보세요.
        </p>
      </div>

      {status === "loading" && (
        <div
          aria-label="후기 불러오는 중"
          className={styles.loadingGrid}
          role="status"
        >
          <span className={styles.screenReaderOnly}>
            여행 기록을 불러오는 중입니다.
          </span>
          {[0, 1].map((item) => (
            <div key={item} className={styles.loadingCard}>
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
          className={styles.inlineState}
          title="여행 기록을 불러오지 못했어요"
          description={errorMessage ?? "잠시 후 다시 시도해 주세요."}
          action={
            <Button
              isLoading={isRetrying}
              loadingLabel="다시 불러오는 중..."
              type="button"
              variant="secondary"
              onClick={onRetry}
            >
              다시 시도
            </Button>
          }
        />
      )}

      {status === "empty" && (
        <EmptyState
          className={styles.inlineState}
          title={
            reviewSummary.hasReviews
              ? "표시할 수 있는 여행 기록이 없어요"
              : "첫 여행 기록을 기다리고 있어요"
          }
          description={
            reviewSummary.hasReviews
              ? "후기 목록이 갱신되면 이곳에서 확인할 수 있어요."
              : "숙박을 마친 게스트의 후기가 등록되면 이곳에서 확인할 수 있어요."
          }
        />
      )}

      {status === "ready" && (
        <>
          {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The scrollable review region supports native keyboard scrolling. */}
          <div
            className={styles.reviewsGrid}
            role="region"
            aria-label="후기 미리보기"
            tabIndex={0}
          >
            {reviews.map((review) => {
              const isExpanded = expandedReviews[review.id];
              const isLongReview =
                review.content.length > maxReviewContentLength;
              const visibleContent =
                isExpanded || !isLongReview
                  ? review.content
                  : `${review.content.substring(0, maxReviewContentLength)}...`;

              return (
                <article key={review.id} className={styles.reviewCard}>
                  <div className={styles.reviewHeader}>
                    <ImageWithFallback
                      alt={`${review.author.name} 프로필`}
                      className={styles.reviewerAvatar}
                      fallback={
                        <AvatarFallback
                          initial={review.author.avatarInitial}
                          name={review.author.name}
                        />
                      }
                      src={review.author.avatarUrl}
                    />
                    <div className={styles.reviewerDetails}>
                      <span className={styles.reviewerName}>
                        {review.author.name}
                      </span>
                      <span className={styles.reviewDate}>
                        {review.date.label}
                      </span>
                    </div>
                  </div>

                  <div className={styles.reviewMeta}>
                    <Rating rating={review.rating} />
                    <span className={styles.reviewMetaDate}>
                      <span aria-hidden="true">·</span> {review.date.label}
                    </span>
                  </div>
                  <p className={styles.reviewContent}>{visibleContent}</p>

                  {isLongReview && (
                    <button
                      className={styles.reviewShowMoreButton}
                      type="button"
                      aria-label="이 후기 전체 보기"
                      onClick={onOpenReviews}
                    >
                      <span className={styles.desktopSummary}>
                        이 후기 전체 보기
                      </span>
                      <span className={styles.mobileMoreLabel}>더 보기</span>
                    </button>
                  )}

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
              );
            })}
          </div>

          {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
          <div className={styles.reviewViewAll}>
            <Button type="button" variant="secondary" onClick={onOpenReviews}>
              후기 {reviewSummary.reviewCount}개 모두 보기
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
