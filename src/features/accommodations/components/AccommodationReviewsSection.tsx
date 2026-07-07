import type { AccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
import type { ReviewViewModel } from "../../reviews/appShell";
import styles from "./AccommodationReviewsSection.module.css";

interface AccommodationReviewsSectionProps {
  reviewSummary: AccommodationDetailViewModel["rating"];
  reviews: ReviewViewModel[];
  expandedReviews: Record<number, boolean>;
  maxReviewContentLength?: number;
  onOpenReviews: () => void;
}

const DEFAULT_MAX_REVIEW_CONTENT_LENGTH = 150;

export function AccommodationReviewsSection({
  reviewSummary,
  reviews,
  expandedReviews,
  maxReviewContentLength = DEFAULT_MAX_REVIEW_CONTENT_LENGTH,
  onOpenReviews,
}: AccommodationReviewsSectionProps) {
  if (!reviewSummary.hasReviews) {
    return null;
  }

  return (
    <section className={`${styles.section} ${styles.reviewSection}`}>
      <h2 className={styles.sectionTitle}>
        ★ {reviewSummary.averageRating.toFixed(2)} · 후기{" "}
        {reviewSummary.reviewCount}개
      </h2>

      {reviews.length > 0 && (
        <div className={styles.reviewsGrid}>
          {reviews.map((review) => {
            const isExpanded = expandedReviews[review.id];
            const isLongReview =
              review.content.length > maxReviewContentLength;
            const visibleContent =
              isExpanded || !isLongReview
                ? review.content
                : `${review.content.substring(0, maxReviewContentLength)}...`;
            return (
              <div key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  <div className={styles.reviewerInfo}>
                    {review.author.avatarUrl ? (
                      <img
                        src={review.author.avatarUrl}
                        alt={review.author.name}
                        className={styles.reviewerAvatar}
                      />
                    ) : (
                      <div className={styles.reviewerAvatarPlaceholder}>
                        {review.author.avatarInitial}
                      </div>
                    )}
                    <div className={styles.reviewerDetails}>
                      <div className={styles.reviewerName}>
                        {review.author.name}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.reviewRating}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <svg
                      key={index}
                      viewBox="0 0 24 24"
                      fill={index < review.rating ? "currentColor" : "none"}
                      stroke="currentColor"
                      className={styles.starIcon}
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>

                <div className={styles.reviewDate}>
                  {review.date.label}
                </div>

                <div className={styles.reviewContent}>{visibleContent}</div>

                {isLongReview && (
                  <button
                    type="button"
                    className={styles.reviewShowMoreButton}
                    onClick={onOpenReviews}
                  >
                    더보기
                  </button>
                )}

                {review.images.length > 0 && (
                  <div className={styles.reviewImages}>
                    {review.images.map((image) => (
                      <img
                        key={image.id}
                        src={image.url}
                        alt={image.alt}
                        className={styles.reviewImage}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reviewSummary.reviewCount > 6 && (
        <div className={styles.reviewViewAll}>
          <button
            type="button"
            className={styles.reviewViewAllButton}
            onClick={onOpenReviews}
          >
            후기 {reviewSummary.reviewCount}개 모두 보기
          </button>
        </div>
      )}
    </section>
  );
}
