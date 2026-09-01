import type { ChangeEvent, FormEvent } from "react";
import {
  Button,
  ImageWithFallback,
  PageContainer,
  RetryableErrorState,
  Skeleton,
  TerminalErrorState,
  ToastHost,
} from "../../shared/ui";
import styles from "./ReviewCreateScreen.module.css";

export interface ReviewCreateReservationView {
  readonly accommodationName: string;
  readonly addressLabel: string;
  readonly dateLabel: string;
  readonly thumbnailUrl: string | null;
}

export type ReviewCreateScreenState =
  | { readonly status: "loading" }
  | {
      readonly status: "retryable-error";
      readonly isRetrying: boolean;
      readonly message: string;
    }
  | { readonly status: "terminal-error"; readonly message: string }
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
  readonly onRetryLoad: () => void;
  readonly onSubmit: () => void;
  readonly onVerifyResult: () => void;
  readonly rating: number;
  readonly state: ReviewCreateScreenState;
}

const RATING_COPY: Readonly<Record<number, string>> = {
  1: "아쉬웠어요",
  2: "기대와 달랐어요",
  3: "괜찮았어요",
  4: "좋았어요",
  5: "기억에 남아요",
};

const ratingCopy = (rating: number): string => RATING_COPY[rating] ?? "";

const AccommodationImageFallback = ({ name }: { readonly name: string }) => (
  <span
    aria-label={`${name} 숙소 이미지 없음`}
    className={styles.accommodationImageFallback}
    role="img"
  >
    <span aria-hidden="true" className={styles.imageFallbackIcon} />
    숙소 사진을 불러올 수 없어요
  </span>
);

const PreviewImageFallback = ({ index }: { readonly index: number }) => (
  <span
    aria-label={`선택한 사진 ${index} 미리보기 없음`}
    className={styles.previewImageFallback}
    role="img"
  >
    미리보기를 불러올 수 없어요
  </span>
);

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
  onRetryLoad,
  onSubmit,
  onVerifyResult,
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
      <PageContainer className={styles.loadingShell} variant="narrow">
        <span className={styles.screenReaderOnly} role="status">
          리뷰 작성 정보를 불러오는 중입니다.
        </span>
        <Skeleton className={styles.loadingBack} />
        <div className={styles.loadingHeader}>
          <Skeleton className={styles.loadingEyebrow} />
          <Skeleton className={styles.loadingTitle} />
          <Skeleton className={styles.loadingSubtitle} />
        </div>
        <Skeleton className={styles.loadingAccommodation} />
        <Skeleton className={styles.loadingRating} />
        <Skeleton className={styles.loadingTextarea} />
        <Skeleton className={styles.loadingUpload} />
      </PageContainer>
    );
  }

  if (state.status === "retryable-error") {
    return (
      <PageContainer className={styles.stateShell} variant="narrow">
        <RetryableErrorState
          title="리뷰 작성 정보를 불러오지 못했어요"
          description={state.message}
          action={
            <div className={styles.stateActions}>
              <Button
                isLoading={state.isRetrying}
                loadingLabel="다시 불러오는 중..."
                type="button"
                onClick={onRetryLoad}
              >
                다시 시도
              </Button>
              <Button type="button" variant="secondary" onClick={onBack}>
                예약 상세로 돌아가기
              </Button>
            </div>
          }
        />
      </PageContainer>
    );
  }

  if (state.status === "terminal-error") {
    return (
      <PageContainer className={styles.stateShell} variant="narrow">
        <TerminalErrorState
          title="리뷰를 작성할 수 없어요"
          description={state.message}
          action={
            <Button type="button" variant="secondary" onClick={onBack}>
              예약 상세로 돌아가기
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const { reservation } = state;
  const isInteractionLocked = isSubmitting || isSubmitLocked;

  return (
    <>
      <PageContainer className={styles.container} variant="narrow">
        <button
          aria-label="예약 상세로 돌아가기"
          className={styles.backButton}
          disabled={isSubmitting}
          type="button"
          onClick={onBack}
        >
          <svg
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <line x1="19" x2="5" y1="12" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>

        <div className={styles.content}>
          <header className={styles.header}>
            <span className={styles.eyebrow}>여행 기록</span>
            <h1 className={styles.title}>숙박 경험 남기기</h1>
            <p className={styles.subtitle}>
              다음 게스트가 머무름을 선택하는 데 도움이 되는 경험을 알려주세요.
            </p>
          </header>

          <section
            aria-labelledby="review-accommodation-title"
            className={styles.accommodationInfo}
          >
            <div className={styles.accommodationMedia}>
              <ImageWithFallback
                alt={reservation.accommodationName}
                className={styles.accommodationImage}
                fallback={
                  <AccommodationImageFallback
                    name={reservation.accommodationName}
                  />
                }
                src={reservation.thumbnailUrl}
              />
            </div>
            <div className={styles.accommodationDetails}>
              <span className={styles.contextLabel}>후기를 남길 숙소</span>
              <h2
                className={styles.accommodationName}
                id="review-accommodation-title"
              >
                {reservation.accommodationName}
              </h2>
              <p className={styles.accommodationAddress}>
                {reservation.addressLabel}
              </p>
              <p className={styles.dates}>{reservation.dateLabel}</p>
            </div>
          </section>

          <form
            aria-busy={isSubmitting}
            className={styles.form}
            onSubmit={handleSubmit}
          >
            <fieldset
              className={styles.ratingSection}
              disabled={isInteractionLocked}
            >
              <legend className={styles.label}>이번 숙박은 어땠나요?</legend>
              <div
                aria-describedby="review-rating-description"
                className={styles.stars}
                role="radiogroup"
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <label key={star} className={styles.starLabel}>
                    <input
                      aria-label={`${star}점`}
                      checked={rating === star}
                      className={styles.ratingInput}
                      name="review-rating"
                      type="radio"
                      value={star}
                      onChange={() => onRatingChange(star)}
                    />
                    <span
                      aria-hidden="true"
                      className={`${styles.starVisual} ${rating >= star ? styles.filled : ""}`}
                    >
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </span>
                  </label>
                ))}
              </div>
              <p className={styles.ratingText} id="review-rating-description">
                {rating}점 · {ratingCopy(rating)}
              </p>
            </fieldset>

            <div className={styles.commentSection}>
              <label htmlFor="review-comment" className={styles.label}>
                머무른 경험
              </label>
              <p className={styles.fieldHint} id="review-comment-hint">
                좋았던 점과 다음 게스트가 알아두면 좋은 점을 솔직하게
                남겨주세요.
              </p>
              <textarea
                aria-label="리뷰 내용"
                aria-describedby="review-comment-hint review-comment-count"
                className={styles.textarea}
                disabled={isInteractionLocked}
                id="review-comment"
                maxLength={1000}
                placeholder="숙소에서 보낸 시간을 들려주세요."
                required
                rows={8}
                value={comment}
                onChange={(event) => onCommentChange(event.target.value)}
              />
              <span className={styles.charCount} id="review-comment-count">
                {comment.length} / 1000자
              </span>
            </div>

            <div className={styles.imageSection}>
              <div className={styles.fieldHeading}>
                <span className={styles.label}>사진 더하기</span>
                <span className={styles.optionalLabel}>선택</span>
              </div>
              <div className={styles.imageUploadArea}>
                <input
                  aria-describedby="review-image-hint"
                  aria-label="사진 선택"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  className={styles.imageInput}
                  disabled={isInteractionLocked}
                  id="review-image-input"
                  multiple
                  type="file"
                  onChange={handleImageSelect}
                />
                <label
                  className={`${styles.imageInputLabel} ${isInteractionLocked ? styles.disabled : ""}`}
                  htmlFor="review-image-input"
                >
                  <svg
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  사진 선택
                </label>
                <p className={styles.imageHint} id="review-image-hint">
                  JPEG, PNG, GIF, WebP · 파일당 최대 10MB
                </p>
              </div>

              {images.length > 0 && (
                <div
                  aria-label="선택한 후기 사진"
                  className={styles.imagePreviewContainer}
                >
                  {images.map((image, index) => (
                    <div key={image.id} className={styles.imagePreviewItem}>
                      <ImageWithFallback
                        alt={`선택한 사진 ${index + 1}`}
                        className={styles.imagePreview}
                        fallback={<PreviewImageFallback index={index + 1} />}
                        src={image.previewUrl}
                      />
                      <button
                        aria-label={`선택한 사진 ${index + 1} 삭제`}
                        className={styles.imageRemoveButton}
                        disabled={isInteractionLocked}
                        type="button"
                        onClick={() => onRemoveImage(image.id)}
                      >
                        <svg
                          aria-hidden="true"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isSubmitLocked && (
              <div className={styles.lockNotice} role="status">
                <strong>제출 결과 확인이 필요해요</strong>
                <span>
                  중복 작성을 피하려면 예약 상세에서 후기 등록 여부를 먼저
                  확인해 주세요.
                </span>
              </div>
            )}

            <div className={styles.actions}>
              {isSubmitLocked ? (
                <Button fullWidth type="button" onClick={onVerifyResult}>
                  예약 상세에서 확인하기
                </Button>
              ) : (
                <>
                  <Button
                    disabled={isSubmitting}
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                  >
                    취소
                  </Button>
                  <Button
                    aria-label={
                      isSubmitting ? "여행 기록 남기는 중" : "리뷰 작성하기"
                    }
                    disabled={!comment.trim()}
                    isLoading={isSubmitting}
                    loadingLabel="여행 기록 남기는 중..."
                    type="submit"
                  >
                    후기 남기기
                  </Button>
                </>
              )}
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
