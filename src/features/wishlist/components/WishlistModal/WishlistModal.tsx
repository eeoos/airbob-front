import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";
import { useIntersectionLoadMore } from "../../../../shared/lib/useIntersectionLoadMore";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import {
  Button,
  Dialog,
  ImageWithFallback,
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

  useEffect(() => {
    interactionGenerationRef.current += 1;
    pendingWishlistIdsRef.current = new Set();
    setPendingWishlistIds(new Set());
    setShowCreateModal(false);
    setError(null);
  }, [accommodationId, isOpen, scope.epoch, scope.subject]);

  useEffect(() => {
    if (isOpen && wishlistsQuery.error) {
      setError(toWishlistErrorMessage(wishlistsQuery.error));
    }
  }, [isOpen, wishlistsQuery.error, wishlistsQuery.errorUpdatedAt]);

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
        <div className={styles.wishlistGrid}>
          {isLoading && (
            <div
              className={styles.loadingIndicator}
              {...stateViewRecipes.loading}
            >
              로딩 중...
            </div>
          )}
          {wishlists.map((wishlist) => {
            const isPending =
              isRefreshing || pendingWishlistIds.has(wishlist.id);

            return (
              <button
                type="button"
                key={wishlist.id}
                className={styles.wishlistItem}
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
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </div>
                    }
                  />
                  <div
                    className={`${styles.wishlistIcon} ${
                      wishlist.isContained ? styles.active : ""
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill={wishlist.isContained ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                </div>
                <div className={styles.wishlistInfo}>
                  <div className={styles.wishlistName}>{wishlist.name}</div>
                  <div className={styles.wishlistCount}>
                    {wishlist.itemCountLabel}
                  </div>
                </div>
              </button>
            );
          })}
          <div ref={setLoadingTarget} className={styles.loadingIndicator}>
            {hasNext && wishlistsQuery.isFetchingNextPage && (
              <span {...stateViewRecipes.loading}>로딩 중...</span>
            )}
          </div>
        </div>

        <Button
          className={styles.createButton}
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
