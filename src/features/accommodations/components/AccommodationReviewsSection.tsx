import { ReviewSummary } from "../../../types/accommodation";
import { ReviewInfo } from "../../../types/review";
import { getImageUrl } from "../../../utils/image";
import styles from "./AccommodationReviewsSection.module.css";

interface AccommodationReviewsSectionProps {
  reviewSummary: ReviewSummary;
  reviews: ReviewInfo[];
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
  if (reviewSummary.total_count <= 0) {
    return null;
  }

  return (
    <section className={`${styles.section} ${styles.reviewSection}`}>
      <h2 className={styles.sectionTitle}>
        ★ {reviewSummary.average_rating.toFixed(2)} · 후기{" "}
        {reviewSummary.total_count}개
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
            const reviewedAt = new Date(review.reviewed_at);

            return (
              <div key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  <div className={styles.reviewerInfo}>
                    {review.reviewer.thumbnail_image_url ? (
                      <img
                        src={getImageUrl(review.reviewer.thumbnail_image_url)}
                        alt={review.reviewer.nickname}
                        className={styles.reviewerAvatar}
                      />
                    ) : (
                      <div className={styles.reviewerAvatarPlaceholder}>
                        {review.reviewer.nickname.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={styles.reviewerDetails}>
                      <div className={styles.reviewerName}>
                        {review.reviewer.nickname}
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
                  {reviewedAt.getFullYear()}년 {reviewedAt.getMonth() + 1}월
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
                        src={getImageUrl(image.image_url)}
                        alt="리뷰 이미지"
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

      {reviewSummary.total_count > 6 && (
        <div className={styles.reviewViewAll}>
          <button
            type="button"
            className={styles.reviewViewAllButton}
            onClick={onOpenReviews}
          >
            후기 {reviewSummary.total_count}개 모두 보기
          </button>
        </div>
      )}
    </section>
  );
}
