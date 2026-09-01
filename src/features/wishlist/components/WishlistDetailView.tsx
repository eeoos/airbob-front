import {
  Button,
  EmptyState,
  ImageWithFallback,
  ListContainer,
  RetryableErrorState,
  Skeleton,
  stateViewRecipes,
} from "../../../shared/ui";
import {
  toWishlistAccommodationMemoTarget,
  type WishlistAccommodationCardViewModel,
  type WishlistAccommodationMemoTarget,
} from "../lib/wishlistAccommodationViewModel";
import styles from "./WishlistViews.module.css";

interface WishlistDetailViewProps {
  errorMessage?: string | null;
  hasNext: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isMutationPending?: boolean;
  isRefreshing?: boolean;
  onBack: () => void;
  onOpenAccommodationDetail: (accommodationId: number) => void;
  onOpenMemo: (item: WishlistAccommodationMemoTarget) => void;
  onRemoveFromWishlist: (wishlistAccommodationId: number) => void;
  onRetry?: () => void;
  selectedWishlistName?: string;
  setWishlistAccommodationsObserverTarget: (node: Element | null) => void;
  wishlistAccommodations: WishlistAccommodationCardViewModel[];
}

const SKELETON_COUNT = 4;

function WishlistDetailSkeleton() {
  return (
    <div className={styles.loadingState} {...stateViewRecipes.loading}>
      <span className={styles.visuallyHidden}>
        위시리스트의 숙소를 불러오는 중입니다.
      </span>
      <div className={styles.detailGrid} aria-hidden="true">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <div className={styles.skeletonCard} key={index}>
            <Skeleton className={styles.skeletonImage} />
            <Skeleton className={styles.skeletonTitle} />
            <Skeleton className={styles.skeletonMeta} />
            <Skeleton className={styles.skeletonMemo} />
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

export function WishlistDetailView({
  errorMessage,
  hasNext,
  isLoading,
  isLoadingMore,
  isMutationPending = false,
  isRefreshing = false,
  onBack,
  onOpenAccommodationDetail,
  onOpenMemo,
  onRemoveFromWishlist,
  onRetry,
  selectedWishlistName = "위시리스트",
  setWishlistAccommodationsObserverTarget,
  wishlistAccommodations,
}: WishlistDetailViewProps) {
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
    <section aria-labelledby="wishlist-detail-title" className={styles.page}>
      <header className={styles.routeHeader}>
        <button
          aria-label="위시리스트 목록으로 돌아가기"
          className={styles.backButton}
          type="button"
          onClick={onBack}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className={styles.routeHeading}>
          <p className={styles.eyebrow}>저장한 여행 아이디어</p>
          <h1 className={styles.recentlyViewedTitle} id="wishlist-detail-title">
            {selectedWishlistName}
          </h1>
          <p className={styles.pageDescription}>
            숙소를 비교하고, 기억할 내용을 메모해 두세요.
          </p>
        </div>
      </header>

      {errorMessage && wishlistAccommodations.length === 0 ? (
        <RetryableErrorState
          action={retryAction}
          className={styles.primaryState}
          description={errorMessage}
          title="저장한 숙소를 불러오지 못했어요"
        />
      ) : isLoading && wishlistAccommodations.length === 0 ? (
        <WishlistDetailSkeleton />
      ) : wishlistAccommodations.length === 0 ? (
        <EmptyState
          className={styles.primaryState}
          description="검색 결과나 숙소 상세에서 하트를 눌러 이 모음에 저장해 보세요."
          title="이 위시리스트는 아직 비어 있어요"
        />
      ) : (
        <>
          {errorMessage && (
            <div className={styles.refreshError} role="alert">
              <div className={styles.refreshErrorCopy}>
                <strong>저장한 숙소를 새로고침하지 못했어요</strong>
                <span>{errorMessage}</span>
              </div>
              {retryAction}
            </div>
          )}
          {isRefreshing && !errorMessage && (
            <span className={styles.visuallyHidden} role="status">
              저장한 숙소를 업데이트하는 중입니다.
            </span>
          )}
          <ListContainer
            aria-busy={isRefreshing || undefined}
            aria-label={`${selectedWishlistName} 숙소 목록`}
            className={styles.detailGrid}
            columns={4}
            gap={40}
            role="list"
          >
            {wishlistAccommodations.map((item) => (
              <article
                key={item.wishlistAccommodationId}
                className={styles.accommodationCard}
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
                  <div className={styles.wishlistCardImage}>
                    <ImageWithFallback
                      src={item.thumbnailUrl}
                      alt={`${item.name} 숙소 사진`}
                      fallback={<AccommodationImageFallback name={item.name} />}
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
                          <span aria-hidden="true" className={styles.star}>
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
                <button
                  className={styles.deleteButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveFromWishlist(item.wishlistAccommodationId);
                  }}
                  aria-label={`${item.name} 위시리스트에서 삭제`}
                  disabled={isMutationPending}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m8 8 8 8M16 8l-8 8" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.memoArea}
                  aria-label={
                    item.memo
                      ? `${item.name} 메모 수정: ${item.memo}`
                      : `${item.name} 메모 추가`
                  }
                  onClick={() =>
                    onOpenMemo(toWishlistAccommodationMemoTarget(item))
                  }
                >
                  {item.memo ? (
                    <span className={styles.memoText}>
                      {item.memo} <span className={styles.memoEdit}>수정</span>
                    </span>
                  ) : (
                    <span className={styles.memoAdd}>메모 추가</span>
                  )}
                </button>
              </article>
            ))}
          </ListContainer>
          {hasNext && (
            <div
              ref={setWishlistAccommodationsObserverTarget}
              className={styles.loadMoreContainer}
            >
              {isLoadingMore && (
                <div
                  className={styles.loadingMore}
                  {...stateViewRecipes.loading}
                >
                  더 많은 숙소를 불러오는 중입니다.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
