import type { InfiniteData } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  const shouldLoadWishlistLists = view.kind !== "recently-viewed";
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
  const recoveringWishlistIdRef = useRef<number | null>(null);
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

  useEffect(() => {
    if (shouldLoadWishlistLists && wishlistsQuery.isError) {
      showQueryError(wishlistsQuery.error);
    }
  }, [
    showQueryError,
    shouldLoadWishlistLists,
    wishlistsQuery.error,
    wishlistsQuery.errorUpdatedAt,
    wishlistsQuery.isError,
  ]);

  useEffect(() => {
    if (shouldLoadRecentlyViewed && recentlyViewedQuery.isError) {
      showQueryError(recentlyViewedQuery.error);
    }
  }, [
    recentlyViewedQuery.error,
    recentlyViewedQuery.errorUpdatedAt,
    recentlyViewedQuery.isError,
    showQueryError,
    shouldLoadRecentlyViewed,
  ]);

  useEffect(() => {
    if (shouldLoadWishlistDetail && detailQuery.isError) {
      showQueryError(detailQuery.error);
    }
  }, [
    detailQuery.error,
    detailQuery.errorUpdatedAt,
    detailQuery.isError,
    showQueryError,
    shouldLoadWishlistDetail,
  ]);

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
  const selectedWishlistName = useMemo(
    () => wishlists.find((wishlist) => wishlist.id === selectedWishlistId)?.name,
    [selectedWishlistId, wishlists],
  );

  useEffect(() => {
    if (
      selectedWishlistId === null ||
      selectedWishlistName !== undefined ||
      !wishlistsHaveNextPage ||
      wishlistsAreFetchingNextPage ||
      recoveringWishlistIdRef.current === selectedWishlistId
    ) {
      return;
    }

    const recoveringWishlistId = selectedWishlistId;
    recoveringWishlistIdRef.current = recoveringWishlistId;

    void fetchNextWishlistPage()
      .catch((error) => {
        const latestView = viewRef.current;
        if (
          latestView.kind === "wishlist-detail" &&
          latestView.wishlistId === recoveringWishlistId
        ) {
          showQueryError(error);
        }
      })
      .finally(() => {
        if (recoveringWishlistIdRef.current === recoveringWishlistId) {
          recoveringWishlistIdRef.current = null;
        }
      });
  }, [
    selectedWishlistId,
    selectedWishlistName,
    fetchNextWishlistPage,
    showQueryError,
    wishlistsAreFetchingNextPage,
    wishlistsHaveNextPage,
  ]);

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
    async (
      wishlistId: number,
      event: React.MouseEvent<HTMLButtonElement>,
    ) => {
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

      const result = await runCommand(
        `remove:${wishlistAccommodationId}`,
        () =>
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
    setMemoState(null);
  }, []);
  const handleSaveMemo = useCallback(async () => {
    if (memoState === null) return;

    const generation = memoState.generation;
    const wishlistAccommodationId = memoState.wishlistAccommodationId;
    const memo = memoState.text.trim();
    const result = await runCommand(
      `memo:${wishlistAccommodationId}`,
      () =>
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
      className={className}
      detail={{
        hasNext: detailHasNextPage,
        isLoading: detailQuery.isPending,
        isLoadingMore: detailIsFetchingNextPage,
        isMutationPending,
        onBack: navigation.openIndex,
        onOpenAccommodationDetail: navigation.openAccommodation,
        onOpenMemo: handleOpenMemo,
        onRemoveFromWishlist: handleRemoveFromWishlist,
        selectedWishlistName: selectedWishlistName ?? "위시리스트",
        setWishlistAccommodationsObserverTarget,
        wishlistAccommodations: wishlistAccommodationCards,
      }}
      errorMessage={errorMessage}
      index={{
        isLoading: wishlistsQuery.isPending || recentlyViewedQuery.isPending,
        isLoadingMoreWishlists: wishlistsAreFetchingNextPage,
        isMutationPending,
        onDeleteWishlist: handleDeleteWishlist,
        onOpenRecentlyViewed: navigation.openRecentlyViewed,
        onOpenWishlist: navigation.openWishlistDetail,
        recentlyViewedSummaryLabel: getRecentlyViewedSummaryLabel(
          recentlyViewedCards,
        ),
        setWishlistsObserverTarget,
        wishlists: wishlistIndexCards,
        wishlistsHasNext: wishlistsHaveNextPage,
      }}
      memoDialog={{
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
        onSave: handleSaveMemo,
      }}
      onClearError={() => setErrorMessage(null)}
      recentlyViewed={{
        isEditMode,
        isMutationPending,
        onBack: navigation.openIndex,
        onOpenAccommodationDetail: navigation.openAccommodation,
        onRemoveRecentlyViewed: handleRemoveRecentlyViewed,
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
    />
  );
}
