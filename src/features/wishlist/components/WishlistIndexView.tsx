import React from "react";
import {
  Button,
  EmptyState,
  ImageWithFallback,
  RetryableErrorState,
  Skeleton,
  stateViewRecipes,
} from "../../../shared/ui";
import type { WishlistIndexCardViewModel } from "../lib/wishlistAccommodationViewModel";
import styles from "./WishlistViews.module.css";

interface WishlistIndexViewProps {
  errorMessage?: string | null;
  isLoading: boolean;
  isLoadingMoreWishlists: boolean;
  isMutationPending?: boolean;
  isRefreshing?: boolean;
  onDeleteWishlist: (
    wishlistId: number,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void;
  onOpenRecentlyViewed: () => void;
  onOpenWishlist: (wishlistId: number) => void;
  onRetry?: () => void;
  recentlyViewedSummaryLabel: string;
  setWishlistsObserverTarget: (node: Element | null) => void;
  wishlists: WishlistIndexCardViewModel[];
  wishlistsHasNext: boolean;
}

const SKELETON_COUNT = 3;

function WishlistIndexSkeleton() {
  return (
    <div className={styles.loadingState} {...stateViewRecipes.loading}>
      <span className={styles.visuallyHidden}>
        저장한 숙소 모음을 불러오는 중입니다.
      </span>
      <div className={styles.wishlistGrid} aria-hidden="true">
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

function CollectionImageFallback({ name }: { readonly name: string }) {
  return (
    <div
      aria-label={`${name} 대표 이미지 없음`}
      className={styles.placeholderImage}
      role="img"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M5 7.5h14v11H5z" />
        <path d="m7.5 15 3-3 2.2 2.2 1.8-1.7 2 2" />
        <circle cx="15.5" cy="10" r="1" />
      </svg>
      <span>아직 대표 사진이 없어요</span>
    </div>
  );
}

export function WishlistIndexView({
  errorMessage,
  isLoading,
  isLoadingMoreWishlists,
  isMutationPending = false,
  isRefreshing = false,
  onDeleteWishlist,
  onOpenRecentlyViewed,
  onOpenWishlist,
  onRetry,
  recentlyViewedSummaryLabel,
  setWishlistsObserverTarget,
  wishlists,
  wishlistsHasNext,
}: WishlistIndexViewProps) {
  const hasRecentlyViewed = recentlyViewedSummaryLabel !== "항목 없음";
  const hasContent = hasRecentlyViewed || wishlists.length > 0;
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
    <section aria-labelledby="wishlist-library-title" className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>나만의 숙소 라이브러리</p>
        <h1 className={styles.pageTitle} id="wishlist-library-title">
          위시리스트
        </h1>
        <p className={styles.pageDescription}>
          마음에 남은 숙소를 모아 다음 여행을 천천히 완성해 보세요.
        </p>
      </header>

      {errorMessage && !hasContent ? (
        <RetryableErrorState
          action={retryAction}
          className={styles.primaryState}
          description={errorMessage}
          title="위시리스트를 불러오지 못했어요"
        />
      ) : isLoading && !hasContent ? (
        <WishlistIndexSkeleton />
      ) : !hasContent ? (
        <EmptyState
          action={
            <Button onClick={onOpenRecentlyViewed} variant="secondary">
              최근 조회 보기
            </Button>
          }
          className={styles.primaryState}
          description="숙소를 둘러보다 마음에 드는 곳을 저장하면 이곳에 모여요."
          title="아직 저장한 숙소가 없어요"
        />
      ) : (
        <>
          {errorMessage && (
            <div className={styles.refreshError} role="alert">
              <div className={styles.refreshErrorCopy}>
                <strong>최신 위시리스트를 불러오지 못했어요</strong>
                <span>{errorMessage}</span>
              </div>
              {retryAction}
            </div>
          )}
          {isRefreshing && !errorMessage && (
            <span className={styles.visuallyHidden} role="status">
              위시리스트를 업데이트하는 중입니다.
            </span>
          )}
          <div
            aria-busy={isRefreshing || undefined}
            aria-label="저장한 숙소 모음"
            className={styles.wishlistGrid}
            role="list"
          >
            {hasRecentlyViewed && (
              <article className={styles.wishlistCard} role="listitem">
                <button
                  aria-label={`최근 조회 열기, ${recentlyViewedSummaryLabel}`}
                  className={styles.cardActionButton}
                  type="button"
                  onClick={onOpenRecentlyViewed}
                >
                  <div className={styles.wishlistCardImage}>
                    <div className={styles.recentCollectionCover}>
                      <span className={styles.recentCollectionIcon}>
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="7" />
                          <path d="m20 20-4-4" />
                        </svg>
                      </span>
                      <span>다시 보고 싶은 숙소</span>
                    </div>
                  </div>
                  <div className={styles.wishlistCardInfo}>
                    <div className={styles.wishlistCardName}>최근 조회</div>
                    <div className={styles.wishlistCardCount}>
                      {recentlyViewedSummaryLabel}
                    </div>
                  </div>
                </button>
              </article>
            )}

            {wishlists.map((wishlist) => (
              <article
                key={wishlist.id}
                className={styles.wishlistCard}
                role="listitem"
              >
                <button
                  aria-label={`${wishlist.name} 위시리스트 열기, ${wishlist.itemCountLabel}`}
                  className={styles.cardActionButton}
                  type="button"
                  onClick={() => onOpenWishlist(wishlist.id)}
                >
                  <div className={styles.wishlistCardImage}>
                    <ImageWithFallback
                      src={wishlist.thumbnailUrl}
                      alt={`${wishlist.name} 대표 사진`}
                      fallback={
                        <CollectionImageFallback name={wishlist.name} />
                      }
                    />
                  </div>
                  <div className={styles.wishlistCardInfo}>
                    <div className={styles.wishlistCardName}>
                      {wishlist.name}
                    </div>
                    <div className={styles.wishlistCardCount}>
                      {wishlist.itemCountLabel}
                    </div>
                  </div>
                </button>
                <button
                  className={styles.wishlistDeleteButton}
                  onClick={(event) => onDeleteWishlist(wishlist.id, event)}
                  aria-label={`${wishlist.name} 위시리스트 삭제`}
                  disabled={isMutationPending}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m8 8 8 8M16 8l-8 8" />
                  </svg>
                </button>
              </article>
            ))}
          </div>
          {wishlistsHasNext && (
            <div
              ref={setWishlistsObserverTarget}
              className={styles.loadMoreContainer}
            >
              {isLoadingMoreWishlists && (
                <div
                  className={styles.loadingMore}
                  {...stateViewRecipes.loading}
                >
                  더 많은 위시리스트를 불러오는 중입니다.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
