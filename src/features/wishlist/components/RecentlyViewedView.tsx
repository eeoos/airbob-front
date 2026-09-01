import { RUNTIME_DESIGN_TOKENS } from "../../../shared/styles/runtimeDesignTokens";
import {
  Button,
  EmptyState,
  ImageWithFallback,
  RetryableErrorState,
  Skeleton,
  stateViewRecipes,
} from "../../../shared/ui";
import { groupRecentlyViewedByDate } from "../lib/recentlyViewedGroups";
import type { RecentlyViewedAccommodationCardViewModel } from "../lib/wishlistAccommodationViewModel";
import styles from "./WishlistViews.module.css";

interface RecentlyViewedViewProps {
  errorMessage?: string | null;
  isEditMode: boolean;
  isLoading?: boolean;
  isMutationPending?: boolean;
  isRefreshing?: boolean;
  onBack: () => void;
  onOpenAccommodationDetail: (accommodationId: number) => void;
  onRemoveRecentlyViewed: (accommodationId: number) => void;
  onRetry?: () => void;
  onToggleEditMode: () => void;
  onWishlistToggle: (accommodationId: number) => void;
  recentlyViewed: RecentlyViewedAccommodationCardViewModel[];
}

const SKELETON_COUNT = 4;

function RecentlyViewedSkeleton() {
  return (
    <div className={styles.loadingState} {...stateViewRecipes.loading}>
      <span className={styles.visuallyHidden}>
        최근 조회한 숙소를 불러오는 중입니다.
      </span>
      <div className={styles.recentlyViewedGrid} aria-hidden="true">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <div className={styles.skeletonCard} key={index}>
            <Skeleton className={styles.skeletonImage} />
            <Skeleton className={styles.skeletonTitle} />
            <Skeleton className={styles.skeletonMeta} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AccommodationImageFallback({ name }: { readonly name: string }) {
  return (
    <div
      aria-label={`${name} 이미지 없음`}
      className={styles.placeholderImage}
      role="img"
    >
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="M5 7.5h14v11H5z" />
        <path d="m7.5 15 3-3 2.2 2.2 1.8-1.7 2 2" />
      </svg>
      <span>숙소 사진을 준비 중이에요</span>
    </div>
  );
}

export function RecentlyViewedView({
  errorMessage,
  isEditMode,
  isLoading = false,
  isMutationPending = false,
  isRefreshing = false,
  onBack,
  onOpenAccommodationDetail,
  onRemoveRecentlyViewed,
  onRetry,
  onToggleEditMode,
  onWishlistToggle,
  recentlyViewed,
}: RecentlyViewedViewProps) {
  const retryAction = onRetry ? (
    <Button
      isLoading={isRefreshing}
      loadingLabel="다시 불러오는 중..."
      onClick={onRetry}
      size="sm"
      variant="secondary"
    >
      다시 시도
    </Button>
  ) : undefined;

  return (
    <section aria-labelledby="recently-viewed-title" className={styles.page}>
      <header className={styles.routeHeader}>
        <button
          aria-label="위시리스트 목록으로 돌아가기"
          className={styles.backButton}
          onClick={onBack}
          type="button"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={RUNTIME_DESIGN_TOKENS.icon.navigationStrokeWidth}
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className={styles.routeHeading}>
          <p className={styles.eyebrow}>최근의 관심</p>
          <h1 className={styles.recentlyViewedTitle} id="recently-viewed-title">
            최근 조회
          </h1>
          <p className={styles.pageDescription}>
            둘러본 숙소를 다시 비교하고, 마음에 드는 곳을 저장하세요.
          </p>
        </div>
        {recentlyViewed.length > 0 && (
          <Button
            aria-pressed={isEditMode}
            className={styles.editButton}
            onClick={onToggleEditMode}
            size="sm"
            variant="secondary"
          >
            {isEditMode ? "편집 완료" : "목록 편집"}
          </Button>
        )}
      </header>

      {isEditMode && recentlyViewed.length > 0 && (
        <div className={styles.editModeNotice} role="status" aria-live="polite">
          <strong>편집 모드</strong>
          <span>
            각 숙소의 삭제 버튼으로 최근 조회 기록에서 제거할 수 있어요.
          </span>
        </div>
      )}

      {errorMessage && recentlyViewed.length === 0 ? (
        <RetryableErrorState
          action={retryAction}
          className={styles.primaryState}
          description={errorMessage}
          title="최근 조회를 불러오지 못했어요"
        />
      ) : isLoading && recentlyViewed.length === 0 ? (
        <RecentlyViewedSkeleton />
      ) : recentlyViewed.length === 0 ? (
        <EmptyState
          className={styles.primaryState}
          description="숙소 상세를 열어보면 이곳에서 다시 확인할 수 있어요."
          title="최근 조회한 숙소가 없어요"
        />
      ) : (
        <>
          {errorMessage && (
            <div className={styles.refreshError} role="alert">
              <div className={styles.refreshErrorCopy}>
                <strong>최근 조회 기록을 새로고침하지 못했어요</strong>
                <span>{errorMessage}</span>
              </div>
              {retryAction}
            </div>
          )}
          {isRefreshing && !errorMessage && (
            <span className={styles.visuallyHidden} role="status">
              최근 조회 기록을 업데이트하는 중입니다.
            </span>
          )}
          <div aria-busy={isRefreshing || undefined}>
            {Object.entries(groupRecentlyViewedByDate(recentlyViewed)).map(
              ([date, items], groupIndex) => (
                <section
                  aria-labelledby={`recently-viewed-group-${groupIndex}`}
                  key={date}
                  className={styles.dateSection}
                >
                  <h2
                    className={styles.dateTitle}
                    id={`recently-viewed-group-${groupIndex}`}
                  >
                    {date}
                  </h2>
                  <div
                    aria-label={`${date}에 조회한 숙소`}
                    className={styles.recentlyViewedGrid}
                    role="list"
                  >
                    {items.map((item) => (
                      <article
                        key={item.accommodationId}
                        className={styles.recentlyViewedCard}
                        role="listitem"
                      >
                        <button
                          aria-label={`${item.name} 숙소 상세 보기`}
                          className={styles.cardActionButton}
                          type="button"
                          onClick={() =>
                            onOpenAccommodationDetail(item.accommodationId)
                          }
                        >
                          <div className={styles.recentlyViewedImageWrapper}>
                            <ImageWithFallback
                              src={item.thumbnailUrl}
                              alt={`${item.name} 숙소 사진`}
                              fallback={
                                <AccommodationImageFallback name={item.name} />
                              }
                            />
                          </div>
                          <div className={styles.wishlistCardInfo}>
                            <div className={styles.locationRow}>
                              <div className={styles.location}>
                                {item.locationLabel}
                              </div>
                              {item.showReview && (
                                <div
                                  aria-label={`평점 ${item.reviewRatingLabel}, 후기 ${item.reviewCountLabel}`}
                                  className={styles.review}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={styles.star}
                                  >
                                    ★
                                  </span>
                                  <span className={styles.rating}>
                                    {item.reviewRatingLabel}
                                  </span>
                                  <span className={styles.reviewCount}>
                                    {item.reviewCountLabel}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className={styles.name}>{item.name}</div>
                          </div>
                        </button>
                        {isEditMode ? (
                          <button
                            className={styles.deleteButtonLeft}
                            onClick={(event) => {
                              event.stopPropagation();
                              onRemoveRecentlyViewed(item.accommodationId);
                            }}
                            aria-label={`${item.name} 최근 조회에서 삭제`}
                            disabled={isMutationPending}
                            type="button"
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24">
                              <path d="m8 8 8 8M16 8l-8 8" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            className={styles.wishlistButton}
                            onClick={(event) => {
                              event.stopPropagation();
                              onWishlistToggle(item.accommodationId);
                            }}
                            aria-label={`${item.name} 위시리스트 ${
                              item.isInWishlist ? "변경" : "저장"
                            }`}
                            disabled={isMutationPending}
                            type="button"
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              fill={
                                item.isInWishlist
                                  ? RUNTIME_DESIGN_TOKENS.color.brand.reference
                                  : "none"
                              }
                              stroke={
                                item.isInWishlist
                                  ? RUNTIME_DESIGN_TOKENS.color.textInverse
                                      .reference
                                  : RUNTIME_DESIGN_TOKENS.color.text.reference
                              }
                              strokeWidth={
                                RUNTIME_DESIGN_TOKENS.icon.wishlistStrokeWidth
                              }
                            >
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}
