import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getRecentlyViewedSummaryLabel,
  toRecentlyViewedAccommodationCardViewModel,
  toWishlistAccommodationCardViewModel,
  toWishlistIndexCardViewModel,
  type WishlistAccommodationMemoTarget,
} from "../../features/wishlist/lib/wishlistAccommodationViewModel";
import type {
  WishlistCollection,
  WishlistDetail,
} from "../../features/wishlist/model";
import {
  useRecentlyViewedReadQuery,
  useWishlistDetailReadQuery,
  useWishlistListsReadQuery,
  type WishlistListsQueryOptions,
} from "../../features/wishlist/queries";
import {
  toWishlistErrorMessage,
  WISHLIST_REFRESH_WARNING_MESSAGE,
} from "../../features/wishlist/components/wishlistErrorMessage";
import { useIntersectionLoadMore } from "../../shared/lib/useIntersectionLoadMore";
import { useWishlistMembership } from "../../workflows/wishlist-membership";
import { WishlistScreen } from "./WishlistScreen";
import type {
  WishlistNavigationCommands,
  WishlistRouteView,
} from "./WishlistScreen";

type WishlistScope = WishlistListsQueryOptions["scope"];

export interface WishlistControllerProps {
  readonly className?: string;
  readonly navigation: WishlistNavigationCommands;
  readonly scope: WishlistScope;
  readonly view: WishlistRouteView;
}

interface MemoState extends WishlistAccommodationMemoTarget {
  readonly generation: number;
  readonly text: string;
}

type MutationKey = string;

const flattenWishlists = (
  data: InfiniteData<WishlistCollection, string | null> | undefined,
) => data?.pages.flatMap((page) => page.wishlists) ?? [];

const flattenWishlistAccommodations = (
  data: InfiniteData<WishlistDetail, string | null> | undefined,
) => data?.pages.flatMap((page) => page.accommodations) ?? [];

export function WishlistController({
  className,
  navigation,
  scope,
  view,
}: WishlistControllerProps) {
  const commands = useWishlistMembership();
  const viewRef = useRef(view);
  viewRef.current = view;

  const selectedWishlistId =
    view.kind === "wishlist-detail" ? view.wishlistId : null;
  const shouldLoadWishlistLists = view.kind === "index";
  const shouldLoadRecentlyViewed = view.kind !== "wishlist-detail";
  const shouldLoadWishlistDetail = selectedWishlistId !== null;
  const wishlistsQuery = useWishlistListsReadQuery({
    enabled: shouldLoadWishlistLists,
    scope,
  });
  const recentlyViewedQuery = useRecentlyViewedReadQuery({
    enabled: shouldLoadRecentlyViewed,
    scope,
  });
  const detailQuery = useWishlistDetailReadQuery({
    enabled: shouldLoadWishlistDetail,
    scope,
    wishlistId: selectedWishlistId,
  });
  const fetchNextWishlistPage = wishlistsQuery.fetchNextPage;
  const wishlistsHaveNextPage = Boolean(wishlistsQuery.hasNextPage);
  const wishlistsAreFetchingNextPage = wishlistsQuery.isFetchingNextPage;
  const fetchNextDetailPage = detailQuery.fetchNextPage;
  const detailHasNextPage = Boolean(detailQuery.hasNextPage);
  const detailIsFetchingNextPage = detailQuery.isFetchingNextPage;
  const mutationScopePrefix = `${scope.subject}:${scope.epoch}:`;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saveModalAccommodationId, setSaveModalAccommodationId] = useState<
    number | null
  >(null);
  const [memoState, setMemoState] = useState<MemoState | null>(null);
  const memoGenerationRef = useRef(0);
  const pendingKeysRef = useRef<Set<MutationKey>>(new Set());
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<MutationKey>>(
    () => new Set(),
  );

  const routeIdentity =
    view.kind === "wishlist-detail"
      ? `${view.kind}:${view.wishlistId}`
      : view.kind;

  useEffect(() => {
    memoGenerationRef.current += 1;
    setIsEditMode(false);
    setSaveModalAccommodationId(null);
    setMemoState(null);
    setErrorMessage(null);
  }, [routeIdentity, scope.epoch, scope.subject]);

  const showQueryError = useCallback((error: unknown) => {
    setErrorMessage(toWishlistErrorMessage(error));
  }, []);

  const runCommand = useCallback(
    async <Result,>(
      operation: MutationKey,
      execute: () => Promise<Result>,
    ): Promise<Result | null> => {
      const key = `${mutationScopePrefix}${operation}`;
      if (pendingKeysRef.current.has(key)) return null;

      const nextPending = new Set(pendingKeysRef.current).add(key);
      pendingKeysRef.current = nextPending;
      setPendingKeys(nextPending);
      setErrorMessage(null);

      try {
        return await execute();
      } catch (error) {
        showQueryError(error);
        return null;
      } finally {
        const remaining = new Set(pendingKeysRef.current);
        remaining.delete(key);
        pendingKeysRef.current = remaining;
        setPendingKeys(remaining);
      }
    },
    [mutationScopePrefix, showQueryError],
  );

  const wishlists = useMemo(
    () => flattenWishlists(wishlistsQuery.data),
    [wishlistsQuery.data],
  );
  const wishlistAccommodations = useMemo(
    () => flattenWishlistAccommodations(detailQuery.data),
    [detailQuery.data],
  );
  const wishlistIndexCards = useMemo(
    () => wishlists.map(toWishlistIndexCardViewModel),
    [wishlists],
  );
  const wishlistAccommodationCards = useMemo(
    () => wishlistAccommodations.map(toWishlistAccommodationCardViewModel),
    [wishlistAccommodations],
  );
  const recentlyViewedCards = useMemo(
    () =>
      (recentlyViewedQuery.data?.accommodations ?? []).map(
        toRecentlyViewedAccommodationCardViewModel,
      ),
    [recentlyViewedQuery.data],
  );
  const selectedWishlistName = detailQuery.data?.pages[0]?.wishlistName;
  const wishlistListsErrorMessage = wishlistsQuery.isError
    ? toWishlistErrorMessage(wishlistsQuery.error)
    : null;
  const recentlyViewedErrorMessage = recentlyViewedQuery.isError
    ? toWishlistErrorMessage(recentlyViewedQuery.error)
    : null;
  const wishlistDetailErrorMessage = detailQuery.isError
    ? toWishlistErrorMessage(detailQuery.error)
    : null;
  const wishlistIndexErrorMessage =
    wishlistListsErrorMessage ?? recentlyViewedErrorMessage;

  const retryWishlistIndex = useCallback(() => {
    setErrorMessage(null);
    void Promise.all([wishlistsQuery.refetch(), recentlyViewedQuery.refetch()]);
  }, [recentlyViewedQuery, wishlistsQuery]);
  const retryRecentlyViewed = useCallback(() => {
    setErrorMessage(null);
    void recentlyViewedQuery.refetch();
  }, [recentlyViewedQuery]);
  const retryWishlistDetail = useCallback(() => {
    setErrorMessage(null);
    void detailQuery.refetch();
  }, [detailQuery]);

  const loadMoreWishlists = useCallback(() => {
    if (!wishlistsHaveNextPage || wishlistsAreFetchingNextPage) return;
    void fetchNextWishlistPage({ cancelRefetch: false }).catch(showQueryError);
  }, [
    fetchNextWishlistPage,
    showQueryError,
    wishlistsAreFetchingNextPage,
    wishlistsHaveNextPage,
  ]);
  const loadMoreWishlistAccommodations = useCallback(() => {
    if (!detailHasNextPage || detailIsFetchingNextPage) return;
    void fetchNextDetailPage({ cancelRefetch: false }).catch(showQueryError);
  }, [
    detailHasNextPage,
    detailIsFetchingNextPage,
    fetchNextDetailPage,
    showQueryError,
  ]);
  const setWishlistsObserverTarget = useIntersectionLoadMore({
    disabled: view.kind !== "index",
    hasNext: wishlistsHaveNextPage,
    isLoading: wishlistsAreFetchingNextPage,
    onLoadMore: loadMoreWishlists,
    rootMargin: "100px",
    threshold: 0.1,
  });
  const setWishlistAccommodationsObserverTarget = useIntersectionLoadMore({
    disabled: view.kind !== "wishlist-detail",
    hasNext: detailHasNextPage,
    isLoading: detailIsFetchingNextPage,
    onLoadMore: loadMoreWishlistAccommodations,
    rootMargin: "100px",
    threshold: 0.1,
  });

  const handleDeleteWishlist = useCallback(
    async (wishlistId: number, event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const result = await runCommand(`delete:${wishlistId}`, () =>
        commands.deleteWishlist({ wishlistId }),
      );

      const latestView = viewRef.current;
      if (
        result?.status === "applied" &&
        latestView.kind === "wishlist-detail" &&
        latestView.wishlistId === wishlistId
      ) {
        navigation.replaceWithIndex();
      }
    },
    [commands, navigation, runCommand],
  );

  const handleRemoveFromWishlist = useCallback(
    async (wishlistAccommodationId: number) => {
      const item = wishlistAccommodations.find(
        (candidate) =>
          candidate.wishlistAccommodationId === wishlistAccommodationId,
      );
      if (!item) return;

      const result = await runCommand(`remove:${wishlistAccommodationId}`, () =>
        commands.removeAccommodation({
          accommodationId: item.accommodation.id,
          wishlistAccommodationId,
        }),
      );

      if (result?.status === "applied-unconfirmed") {
        setErrorMessage(WISHLIST_REFRESH_WARNING_MESSAGE);
      }
    },
    [commands, runCommand, wishlistAccommodations],
  );

  const handleRemoveRecentlyViewed = useCallback(
    async (accommodationId: number) => {
      await runCommand(`recently-viewed:${accommodationId}`, () =>
        commands.removeRecentlyViewed({ accommodationId }),
      );
    },
    [commands, runCommand],
  );

  const handleOpenMemo = useCallback(
    (target: WishlistAccommodationMemoTarget) => {
      memoGenerationRef.current += 1;
      setErrorMessage(null);
      setMemoState({
        ...target,
        generation: memoGenerationRef.current,
        text: target.memo ?? "",
      });
    },
    [],
  );
  const handleCloseMemo = useCallback(() => {
    memoGenerationRef.current += 1;
    setErrorMessage(null);
    setMemoState(null);
  }, []);
  const handleSaveMemo = useCallback(async () => {
    if (memoState === null) return;

    const generation = memoState.generation;
    const wishlistAccommodationId = memoState.wishlistAccommodationId;
    const memo = memoState.text.trim();
    const result = await runCommand(`memo:${wishlistAccommodationId}`, () =>
      commands.saveMemo({
        memo,
        wishlistAccommodationId,
      }),
    );

    if (result?.status === "applied") {
      setMemoState((current) =>
        current?.generation === generation &&
        current.wishlistAccommodationId === wishlistAccommodationId &&
        current.text.trim() === memo
          ? null
          : current,
      );
    }
  }, [commands, memoState, runCommand]);

  const isMutationPending = Array.from(pendingKeys).some((key) =>
    key.startsWith(mutationScopePrefix),
  );

  return (
    <WishlistScreen
      detail={{
        errorMessage: wishlistDetailErrorMessage,
        hasNext: detailHasNextPage,
        isLoading: detailQuery.isPending,
        isLoadingMore: detailIsFetchingNextPage,
        isMutationPending,
        isRefreshing: detailQuery.isFetching && !detailQuery.isPending,
        onBack: navigation.openIndex,
        onOpenAccommodationDetail: navigation.openAccommodation,
        onOpenMemo: handleOpenMemo,
        onRemoveFromWishlist: handleRemoveFromWishlist,
        onRetry: retryWishlistDetail,
        selectedWishlistName: selectedWishlistName ?? "위시리스트",
        setWishlistAccommodationsObserverTarget,
        wishlistAccommodations: wishlistAccommodationCards,
      }}
      errorMessage={memoState === null ? errorMessage : null}
      index={{
        errorMessage: wishlistIndexErrorMessage,
        isLoading: wishlistsQuery.isPending || recentlyViewedQuery.isPending,
        isLoadingMoreWishlists: wishlistsAreFetchingNextPage,
        isMutationPending,
        isRefreshing:
          (wishlistsQuery.isFetching && !wishlistsQuery.isPending) ||
          (recentlyViewedQuery.isFetching && !recentlyViewedQuery.isPending),
        onDeleteWishlist: handleDeleteWishlist,
        onOpenRecentlyViewed: navigation.openRecentlyViewed,
        onOpenWishlist: navigation.openWishlistDetail,
        onRetry: retryWishlistIndex,
        recentlyViewedSummaryLabel:
          getRecentlyViewedSummaryLabel(recentlyViewedCards),
        setWishlistsObserverTarget,
        wishlists: wishlistIndexCards,
        wishlistsHasNext: wishlistsHaveNextPage,
      }}
      memoDialog={{
        errorMessage,
        isOpen: memoState !== null,
        isPending:
          memoState !== null &&
          pendingKeys.has(
            `${mutationScopePrefix}memo:${memoState.wishlistAccommodationId}`,
          ),
        memoText: memoState?.text ?? "",
        onChangeMemoText: (text) =>
          setMemoState((current) =>
            current === null ? null : { ...current, text: text.slice(0, 250) },
          ),
        onClear: () =>
          setMemoState((current) =>
            current === null ? null : { ...current, text: "" },
          ),
        onClose: handleCloseMemo,
        onDismissError: () => setErrorMessage(null),
        onSave: handleSaveMemo,
      }}
      onClearError={() => setErrorMessage(null)}
      recentlyViewed={{
        errorMessage: recentlyViewedErrorMessage,
        isEditMode,
        isLoading: recentlyViewedQuery.isPending,
        isMutationPending,
        isRefreshing:
          recentlyViewedQuery.isFetching && !recentlyViewedQuery.isPending,
        onBack: navigation.openIndex,
        onOpenAccommodationDetail: navigation.openAccommodation,
        onRemoveRecentlyViewed: handleRemoveRecentlyViewed,
        onRetry: retryRecentlyViewed,
        onToggleEditMode: () => setIsEditMode((current) => !current),
        onWishlistToggle: setSaveModalAccommodationId,
        recentlyViewed: recentlyViewedCards,
      }}
      saveModal={
        saveModalAccommodationId === null
          ? null
          : {
              accommodationId: saveModalAccommodationId,
              commands,
              onClose: () => setSaveModalAccommodationId(null),
              scope,
            }
      }
      view={view}
      {...(className === undefined ? {} : { className })}
    />
  );
}
