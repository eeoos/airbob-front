import type { ChangeEvent, FormEvent } from "react";
import { PageContainer, ToastHost } from "../../shared/ui";
import styles from "./ReviewCreateScreen.module.css";

export interface ReviewCreateReservationView {
  readonly accommodationName: string;
  readonly addressLabel: string;
  readonly dateLabel: string;
  readonly thumbnailUrl: string | null;
}

export type ReviewCreateScreenState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly reservation: ReviewCreateReservationView;
    };

interface ReviewCreateImageView {
  readonly id: string;
  readonly previewUrl: string;
}

export interface ReviewCreateScreenProps {
  readonly comment: string;
  readonly errorMessage: string | null;
  readonly images: readonly ReviewCreateImageView[];
  readonly isSubmitting: boolean;
  readonly isSubmitLocked: boolean;
  readonly onBack: () => void;
  readonly onCancel: () => void;
  readonly onClearError: () => void;
  readonly onCommentChange: (comment: string) => void;
  readonly onImagesSelected: (files: readonly File[]) => void;
  readonly onRatingChange: (rating: number) => void;
  readonly onRemoveImage: (imageId: string) => void;
  readonly onSubmit: () => void;
  readonly rating: number;
  readonly state: ReviewCreateScreenState;
}

const ratingCopy = (rating: number): string =>
  ({
    1: "최악이에요",
    2: "별로예요",
    3: "괜찮아요",
    4: "좋아요",
    5: "완벽해요!",
  })[rating] ?? "";

export function ReviewCreateScreen({
  comment,
  errorMessage,
  images,
  isSubmitting,
  isSubmitLocked,
  onBack,
  onCancel,
  onClearError,
  onCommentChange,
  onImagesSelected,
  onRatingChange,
  onRemoveImage,
  onSubmit,
  rating,
  state,
}: ReviewCreateScreenProps) {
  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) onImagesSelected(files);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  if (state.status === "loading") {
    return (
      <PageContainer className={styles.loading} variant="narrow">
        로딩 중...
      </PageContainer>
    );
  }

  if (state.status === "error") {
    return (
      <PageContainer className={styles.error} role="alert" variant="narrow">
        {state.message}
      </PageContainer>
    );
  }

  const { reservation } = state;

  return (
    <>
      <PageContainer className={styles.container} variant="narrow">
        <button
          aria-label="뒤로 가기"
          className={styles.backButton}
          type="button"
          onClick={onBack}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>

        <div className={styles.content}>
          <div className={styles.header}>
            <h1 className={styles.title}>리뷰 작성</h1>
            <p className={styles.subtitle}>
              {reservation.accommodationName}에 대한 리뷰를 작성해주세요.
            </p>
          </div>

          <div className={styles.accommodationInfo}>
            {reservation.thumbnailUrl && (
              <img
                src={reservation.thumbnailUrl}
                alt={reservation.accommodationName}
                className={styles.accommodationImage}
              />
            )}
            <div className={styles.accommodationDetails}>
              <h2 className={styles.accommodationName}>
                {reservation.accommodationName}
              </h2>
              <p className={styles.accommodationAddress}>
                {reservation.addressLabel}
              </p>
              <p className={styles.dates}>{reservation.dateLabel}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.ratingSection}>
              <span className={styles.label}>평점</span>
              <div className={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`${styles.starButton} ${rating >= star ? styles.filled : ""}`}
                    onClick={() => onRatingChange(star)}
                    aria-label={`${star}점`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
                <span className={styles.ratingText}>{ratingCopy(rating)}</span>
              </div>
            </div>

            <div className={styles.commentSection}>
              <label htmlFor="comment" className={styles.label}>
                리뷰 내용
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(event) => onCommentChange(event.target.value)}
                className={styles.textarea}
                placeholder="숙소에 대한 경험을 공유해주세요..."
                rows={8}
                maxLength={1000}
                required
              />
              <div className={styles.charCount}>{comment.length} / 1000</div>
            </div>

            <div className={styles.imageSection}>
              <span className={styles.label}>사진 추가 (선택사항)</span>
              <div className={styles.imageUploadArea}>
                <input
                  type="file"
                  id="review-image-input"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  className={styles.imageInput}
                  disabled={isSubmitting}
                  aria-label="사진 선택"
                />
                <label
                  htmlFor="review-image-input"
                  className={`${styles.imageInputLabel} ${isSubmitting ? styles.disabled : ""}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>사진 선택</span>
                </label>
                <p className={styles.imageHint}>
                  최대 10MB까지 업로드 가능합니다. (JPEG, PNG, GIF, WebP)
                </p>
              </div>

              {images.length > 0 && (
                <div className={styles.imagePreviewContainer}>
                  {images.map((image, index) => (
                    <div key={image.id} className={styles.imagePreviewItem}>
                      <img
                        src={image.previewUrl}
                        alt={`미리보기 ${index + 1}`}
                        className={styles.imagePreview}
                      />
                      <button
                        type="button"
                        className={styles.imageRemoveButton}
                        onClick={() => onRemoveImage(image.id)}
                        disabled={isSubmitting}
                        aria-label="이미지 삭제"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onCancel}
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={isSubmitting || isSubmitLocked || !comment.trim()}
              >
                {isSubmitting
                  ? "제출 중..."
                  : isSubmitLocked
                    ? "예약 상세에서 결과 확인"
                    : "리뷰 작성하기"}
              </button>
            </div>
          </form>
        </div>
      </PageContainer>

      {errorMessage && (
        <ToastHost
          closeLabel="오류 닫기"
          message={errorMessage}
          onClose={onClearError}
        />
      )}
    </>
  );
}
