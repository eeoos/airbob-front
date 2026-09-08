import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";
import { useIntersectionLoadMore } from "../../../../shared/lib/useIntersectionLoadMore";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import {
  Button,
  Dialog,
  EmptyState,
  ImageWithFallback,
  RetryableErrorState,
  Skeleton,
  stateViewRecipes,
  ToastHost,
} from "../../../../shared/ui";
import { useWishlistListsReadQuery } from "../../queries";
import {
  toWishlistModalItemViewModel,
  type WishlistModalItemViewModel,
} from "../../lib/wishlistAccommodationViewModel";
import { CreateWishlistModal } from "../CreateWishlistModal/CreateWishlistModal";
import {
  toWishlistErrorMessage,
  WISHLIST_REFRESH_WARNING_MESSAGE,
} from "../wishlistErrorMessage";
import type {
  CreateAndAddWishlistCommandResult,
  WishlistMembershipCommandPort,
} from "../../ports/wishlistMembershipCommandPort";
import styles from "./WishlistModal.module.css";

export interface WishlistModalProps {
  readonly accommodationId: number;
  readonly commands: WishlistMembershipCommandPort;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly scope: AuthenticatedSessionScope;
}

const removePendingWishlistId = (
  pendingWishlistIds: ReadonlySet<number>,
  wishlistId: number,
) => {
  const next = new Set(pendingWishlistIds);
  next.delete(wishlistId);
  return next;
};

const MODAL_SKELETON_COUNT = 4;

function WishlistModalSkeleton() {
  return (
    <div className={styles.loadingState} {...stateViewRecipes.loading}>
      <span className={styles.visuallyHidden}>
        위시리스트를 불러오는 중입니다.
      </span>
      <div className={styles.wishlistGrid} aria-hidden="true">
        {Array.from({ length: MODAL_SKELETON_COUNT }, (_, index) => (
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

export function WishlistModal({
  accommodationId,
  commands,
  isOpen,
  onClose,
  scope,
}: WishlistModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [pendingWishlistIds, setPendingWishlistIds] = useState<
    ReadonlySet<number>
  >(() => new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const interactionGenerationRef = useRef(0);
  const pendingWishlistIdsRef = useRef(new Set<number>());
  const wishlistsQuery = useWishlistListsReadQuery({
    accommodationId,
    enabled: isOpen,
    scope,
  });

  const wishlists = useMemo(
    () =>
      isOpen
        ? (wishlistsQuery.data?.pages.flatMap((page) =>
            page.wishlists.map(toWishlistModalItemViewModel),
          ) ?? [])
        : [],
    [isOpen, wishlistsQuery.data],
  );
  const isRefreshing =
    isOpen && wishlists.length > 0 && wishlistsQuery.isFetching;
  const isLoading =
    isOpen &&
    (wishlistsQuery.isLoading ||
      (wishlistsQuery.isFetching && wishlists.length === 0));
  const hasNext = isOpen && Boolean(wishlistsQuery.hasNextPage);
  const queryErrorMessage = wishlistsQuery.isError
    ? toWishlistErrorMessage(wishlistsQuery.error)
    : null;

  useEffect(() => {
    interactionGenerationRef.current += 1;
    pendingWishlistIdsRef.current = new Set();
    setPendingWishlistIds(new Set());
    setShowCreateModal(false);
    setError(null);
  }, [accommodationId, isOpen, scope.epoch, scope.subject]);

  const loadMoreWishlists = useCallback(async () => {
    if (!wishlistsQuery.hasNextPage || wishlistsQuery.isFetching) return;

    setError(null);
    try {
      await wishlistsQuery.fetchNextPage({ cancelRefetch: false });
    } catch (paginationError) {
      setError(toWishlistErrorMessage(paginationError));
    }
  }, [wishlistsQuery]);

  const setLoadingTarget = useIntersectionLoadMore({
    disabled: !isOpen,
    hasNext,
    isLoading: wishlistsQuery.isFetchingNextPage,
    onLoadMore: loadMoreWishlists,
    rootMargin: "100px",
  });

  const handleClose = useCallback(() => {
    interactionGenerationRef.current += 1;
    pendingWishlistIdsRef.current = new Set();
    setPendingWishlistIds(new Set());
    setShowCreateModal(false);
    setError(null);
    onClose();
  }, [onClose]);

  const toggleWishlist = useCallback(
    async (wishlist: WishlistModalItemViewModel) => {
      if (
        !isOpen ||
        isRefreshing ||
        pendingWishlistIdsRef.current.has(wishlist.id)
      ) {
        return;
      }

      const generation = interactionGenerationRef.current;
      const nextPendingIds = new Set(pendingWishlistIdsRef.current);
      nextPendingIds.add(wishlist.id);
      pendingWishlistIdsRef.current = nextPendingIds;
      setPendingWishlistIds(nextPendingIds);
      setError(null);

      try {
        const result =
          wishlist.isContained && wishlist.wishlistAccommodationId !== null
            ? await commands.removeAccommodation({
                accommodationId,
                wishlistAccommodationId: wishlist.wishlistAccommodationId,
              })
            : await commands.addAccommodation({
                accommodationId,
                wishlistId: wishlist.id,
              });

        if (generation !== interactionGenerationRef.current) return;
        if (result.status === "applied-unconfirmed") {
          setError(WISHLIST_REFRESH_WARNING_MESSAGE);
        }
      } catch (mutationError) {
        if (generation === interactionGenerationRef.current) {
          setError(toWishlistErrorMessage(mutationError));
        }
      } finally {
        if (generation === interactionGenerationRef.current) {
          pendingWishlistIdsRef.current = removePendingWishlistId(
            pendingWishlistIdsRef.current,
            wishlist.id,
          );
          setPendingWishlistIds(pendingWishlistIdsRef.current);
        }
      }
    },
    [accommodationId, commands, isOpen, isRefreshing],
  );

  const handleCreateComplete = useCallback(
    (
      result: Extract<
        CreateAndAddWishlistCommandResult,
        { readonly status: "applied" | "applied-unconfirmed" }
      >,
    ) => {
      setShowCreateModal(false);
      if (result.status === "applied-unconfirmed") {
        setError(WISHLIST_REFRESH_WARNING_MESSAGE);
      }
    },
    [],
  );

  const retryWishlists = useCallback(() => {
    setError(null);
    void wishlistsQuery.refetch();
  }, [wishlistsQuery]);

  if (!isOpen) return null;

  return (
    <>
      <Dialog
        isOpen={isOpen}
        title="위시리스트에 저장하기"
        onClose={handleClose}
        className={requireCssModuleClass(styles.dialog)}
        bodyClassName={requireCssModuleClass(styles.content)}
      >
        <div
          aria-busy={
            isLoading || isRefreshing || pendingWishlistIds.size > 0
              ? true
              : undefined
          }
          className={styles.libraryBody}
        >
          {queryErrorMessage && wishlists.length === 0 ? (
            <RetryableErrorState
              action={
                <Button
                  isLoading={isLoading}
                  loadingLabel="다시 불러오는 중..."
                  onClick={retryWishlists}
                  size="sm"
                  variant="secondary"
                >
                  다시 시도
                </Button>
              }
              className={styles.dialogState}
              description={queryErrorMessage}
              title="위시리스트를 불러오지 못했어요"
            />
          ) : isLoading && wishlists.length === 0 ? (
            <WishlistModalSkeleton />
          ) : wishlists.length === 0 ? (
            <EmptyState
              className={styles.dialogState}
              description="새 모음을 만들면 이 숙소를 바로 저장할 수 있어요."
              title="아직 만든 위시리스트가 없어요"
            />
          ) : (
            <>
              {queryErrorMessage && (
                <div className={styles.refreshError} role="alert">
                  <div>
                    <strong>최신 목록을 불러오지 못했어요</strong>
                    <span>{queryErrorMessage}</span>
                  </div>
                  <Button
                    isLoading={isRefreshing}
                    loadingLabel="다시 불러오는 중..."
                    onClick={retryWishlists}
                    size="sm"
                    variant="secondary"
                  >
                    다시 시도
                  </Button>
                </div>
              )}
              <div
                aria-label="저장할 위시리스트 선택"
                className={styles.wishlistGrid}
                role="group"
              >
                {wishlists.map((wishlist) => {
                  const isPending =
                    isRefreshing || pendingWishlistIds.has(wishlist.id);

                  return (
                    <button
                      type="button"
                      key={wishlist.id}
                      className={styles.wishlistItem}
                      aria-label={`${wishlist.name}, ${wishlist.itemCountLabel}, ${
                        wishlist.isContained ? "저장됨" : "저장되지 않음"
                      }`}
                      aria-pressed={wishlist.isContained}
                      aria-busy={isPending || undefined}
                      disabled={isPending}
                      onClick={() => void toggleWishlist(wishlist)}
                    >
                      <div className={styles.wishlistImage}>
                        <ImageWithFallback
                          src={wishlist.thumbnailUrl}
                          alt={wishlist.name}
                          fallback={
                            <div className={styles.placeholderImage}>
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <path d="M5 7.5h14v11H5z" />
                                <path d="m7.5 15 3-3 2.2 2.2 1.8-1.7 2 2" />
                              </svg>
                              <span>대표 사진 없음</span>
                            </div>
                          }
                        />
                      </div>
                      <div className={styles.wishlistInfo}>
                        <div className={styles.wishlistName}>
                          {wishlist.name}
                        </div>
                        <div className={styles.wishlistCount}>
                          {wishlist.itemCountLabel}
                        </div>
                        {wishlist.isContained && (
                          <svg
                            aria-hidden="true"
                            className={styles.savedIndicator}
                            viewBox="0 0 24 24"
                          >
                            <path d="m5 12 4 4L19 6" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
                <div ref={setLoadingTarget} className={styles.loadingIndicator}>
                  {hasNext && wishlistsQuery.isFetchingNextPage && (
                    <span {...stateViewRecipes.loading}>
                      더 많은 위시리스트를 불러오는 중입니다.
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <Button
          className={styles.createButton}
          disabled={isLoading || isRefreshing}
          onClick={() => {
            setError(null);
            setShowCreateModal(true);
          }}
        >
          새로운 위시리스트 만들기
        </Button>
        {error && (
          <div className={styles.toastContainer}>
            <ToastHost
              closeLabel="오류 닫기"
              message={error}
              onClose={() => setError(null)}
            />
          </div>
        )}
      </Dialog>

      <CreateWishlistModal
        accommodationId={accommodationId}
        commands={commands}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onComplete={handleCreateComplete}
      />
    </>
  );
}
