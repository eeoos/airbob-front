import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WishlistMembershipCommandPort } from "../../features/wishlist/ports/wishlistMembershipCommandPort";
import type { WishlistModalProps } from "../../features/wishlist/components/WishlistModal";
import { toWishlistErrorMessage } from "../../features/wishlist/components/wishlistErrorMessage";
import type { SearchMapBounds } from "../../features/search/components/SearchMap/types";
import {
  toSearchAccommodationCardViewModel,
  toSearchAccommodationMapViewModel,
} from "../../features/search/lib/searchAccommodationViewModel";
import {
  SEARCH_PAGE_LIMIT,
  toSearchRequest,
} from "../../features/search/lib/searchRequest";
import type {
  SearchCommittedRouteState,
  SearchResultPage,
} from "../../features/search/model/search";
import {
  useSearchResultsReadQuery,
  type SearchResultsQueryOptions,
} from "../../features/search/queries/searchQueries";
import { useSearchBottomSheet } from "../../features/search/hooks/useSearchBottomSheet";
import { useSearchMapState } from "../../features/search/hooks/useSearchMapState";
import { SearchScreen } from "./SearchScreen";

type SearchQueryScope = SearchResultsQueryOptions["scope"];

export interface SearchNavigationCommands {
  readonly getAccommodationHref: (accommodationId: number) => string;
  readonly openAccommodation: (accommodationId: number) => void;
  readonly openPage: (page: number) => void;
  readonly replaceMapBounds: (bounds: SearchMapBounds) => void;
}

export interface SearchWishlistAuthIntent {
  readonly request: (accommodationId: number) => number;
  readonly cancel: (attemptId: number) => void;
  readonly resumed: {
    readonly attemptId: number;
    readonly accommodationId: number;
    readonly isCurrent: () => boolean;
  } | null;
  readonly completeResume: (attemptId: number) => void;
}

interface SearchWishlistMembership {
  readonly commands: WishlistMembershipCommandPort;
  readonly scope: WishlistModalProps["scope"];
}

export interface SearchControllerProps {
  readonly isAuthenticated: boolean;
  readonly navigation: SearchNavigationCommands;
  readonly routeState: SearchCommittedRouteState;
  readonly scope: SearchQueryScope;
  readonly wishlistAuthIntent?: SearchWishlistAuthIntent;
  readonly wishlistMembership?: SearchWishlistMembership;
}

const toViewport = (
  routeState: SearchCommittedRouteState,
): SearchMapBounds | null => {
  const {
    topLeftLat: north,
    topLeftLng: west,
    bottomRightLat: south,
    bottomRightLng: east,
  } = routeState;

  if (
    north === undefined ||
    west === undefined ||
    south === undefined ||
    east === undefined
  ) {
    return null;
  }

  return { north, west, south, east };
};

const searchRequestIdentity = (
  request: ReturnType<typeof toSearchRequest>,
): string => JSON.stringify(request);

const retainedSearchResultIdentity = (
  scope: SearchQueryScope,
  state: SearchCommittedRouteState,
): string =>
  JSON.stringify([
    scope.subject,
    scope.epoch,
    state.destination,
    state.checkIn,
    state.checkOut,
    state.adultOccupancy,
    state.childOccupancy,
    state.infantOccupancy,
    state.petOccupancy,
  ]);

const clampResultPage = (page: number, totalPages: number): number => {
  const limitedTotalPages = Math.max(
    0,
    Math.min(totalPages, SEARCH_PAGE_LIMIT),
  );

  return limitedTotalPages === 0
    ? 0
    : Math.max(0, Math.min(page, limitedTotalPages - 1));
};

const toSearchErrorMessage = (error: unknown): string => {
  const kind =
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    typeof error.kind === "string"
      ? error.kind
      : null;

  if (kind === "network" || kind === "timeout") {
    return "네트워크 연결을 확인한 뒤 다시 시도해주세요.";
  }
  if (kind === "authentication") {
    return "로그인이 필요한 요청입니다.";
  }
  if (kind === "validation") {
    return "검색 조건을 확인해주세요.";
  }

  return "검색 결과를 불러오지 못했습니다.";
};

export function SearchController({
  isAuthenticated,
  navigation,
  routeState,
  scope,
  wishlistAuthIntent,
  wishlistMembership,
}: SearchControllerProps) {
  const bottomSheet = useSearchBottomSheet();
  const {
    handleAccommodationSelect,
    hoveredAccommodationId,
    isMapExpanded,
    onMapBoundsUpdated,
    requestMapBoundsUpdate,
    selectAccommodationId,
    selectedAccommodationId,
    setHoveredAccommodationId,
    shouldUpdateMapBounds,
    toggleMapExpanded,
  } = useSearchMapState();
  const request = useMemo(() => toSearchRequest(routeState), [routeState]);
  const query = useSearchResultsReadQuery({ request, scope });
  const { refetch: refetchSearchResults } = query;
  const viewport = useMemo(() => toViewport(routeState), [routeState]);
  const isRouteMapDragMode =
    viewport !== null && routeState.destination === undefined;
  const previousRequestIdentityRef = useRef<string | undefined>(undefined);
  const pendingBoundsRequestRef = useRef<string | null>(null);
  const suspendedBoundsRequestRef = useRef<string | null>(null);
  const pendingAuthAttemptIdRef = useRef<number | null>(null);
  const handledResumeAttemptRef = useRef<number | null>(null);
  const retainedResultRef = useRef<{
    readonly identity: string;
    readonly result: SearchResultPage;
  } | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  const [removingAccommodationIds, setRemovingAccommodationIds] = useState<
    ReadonlySet<number>
  >(() => new Set());
  const removingAccommodationIdsRef = useRef(new Set<number>());
  const wishlistGenerationRef = useRef(0);
  const [pendingWishlistAccommodationId, setPendingWishlistAccommodationId] =
    useState<number | null>(null);
  const [wishlistAccommodationId, setWishlistAccommodationId] = useState<
    number | null
  >(null);
  const [userDragRequestIdentity, setUserDragRequestIdentity] = useState<
    string | null
  >(null);

  const requestIdentity = useMemo(
    () => searchRequestIdentity(request),
    [request],
  );
  const isMapDragMode =
    isRouteMapDragMode || userDragRequestIdentity === requestIdentity;
  const retainedResultIdentity = retainedSearchResultIdentity(
    scope,
    routeState,
  );

  useEffect(() => {
    if (
      userDragRequestIdentity !== null &&
      (isRouteMapDragMode || userDragRequestIdentity !== requestIdentity)
    ) {
      setUserDragRequestIdentity(null);
    }
  }, [isRouteMapDragMode, requestIdentity, userDragRequestIdentity]);

  useEffect(() => {
    if (!query.data || query.isError || query.isPlaceholderData) return;

    retainedResultRef.current = {
      identity: retainedResultIdentity,
      result: query.data,
    };
  }, [
    query.data,
    query.dataUpdatedAt,
    query.isError,
    query.isPlaceholderData,
    retainedResultIdentity,
  ]);

  useEffect(() => {
    if (pendingBoundsRequestRef.current !== requestIdentity) {
      pendingBoundsRequestRef.current = null;
    }
    if (suspendedBoundsRequestRef.current !== requestIdentity) {
      suspendedBoundsRequestRef.current = null;
    }
  }, [requestIdentity, scope.epoch, scope.subject]);

  useEffect(() => {
    if (!query.isError) return;

    pendingBoundsRequestRef.current = null;
  }, [query.errorUpdatedAt, query.isError]);

  useEffect(() => {
    const previousRequestIdentity = previousRequestIdentityRef.current;
    previousRequestIdentityRef.current = requestIdentity;

    if (
      previousRequestIdentity === undefined ||
      previousRequestIdentity === requestIdentity ||
      pendingBoundsRequestRef.current === requestIdentity
    ) {
      return;
    }

    pendingBoundsRequestRef.current = isMapDragMode ? null : requestIdentity;
  }, [isMapDragMode, requestIdentity]);

  useEffect(() => {
    if (
      !query.data ||
      query.isError ||
      query.isPlaceholderData ||
      query.isFetching
    ) {
      return;
    }

    if (pendingBoundsRequestRef.current === requestIdentity) {
      pendingBoundsRequestRef.current = null;
      requestMapBoundsUpdate();
    }
  }, [
    query.data,
    query.dataUpdatedAt,
    query.isError,
    query.isFetching,
    query.isPlaceholderData,
    requestIdentity,
    requestMapBoundsUpdate,
  ]);

  useEffect(() => {
    const resumed = wishlistAuthIntent?.resumed;
    if (!resumed || handledResumeAttemptRef.current === resumed.attemptId) {
      return;
    }

    handledResumeAttemptRef.current = resumed.attemptId;
    pendingAuthAttemptIdRef.current = null;
    setAuthModalOpen(false);
    setPendingWishlistAccommodationId(null);

    if (isAuthenticated && resumed.isCurrent()) {
      setWishlistAccommodationId(resumed.accommodationId);
    }

    wishlistAuthIntent.completeResume(resumed.attemptId);
  }, [isAuthenticated, wishlistAuthIntent]);

  useEffect(() => {
    const pendingIds = removingAccommodationIdsRef.current;
    setWishlistAccommodationId(null);
    setWishlistError(null);
    setRemovingAccommodationIds(new Set());
    return () => {
      wishlistGenerationRef.current += 1;
      pendingIds.clear();
    };
  }, [wishlistMembership?.scope.epoch, wishlistMembership?.scope.subject]);

  const retainedResult =
    query.isError &&
    retainedResultRef.current?.identity === retainedResultIdentity
      ? retainedResultRef.current.result
      : undefined;
  const visibleResult = query.data ?? retainedResult;
  const isShowingRetainedResult = query.data === undefined && !!retainedResult;
  const accommodations = useMemo(
    () => visibleResult?.accommodations ?? [],
    [visibleResult?.accommodations],
  );
  const accommodationCards = useMemo(
    () => accommodations.map(toSearchAccommodationCardViewModel),
    [accommodations],
  );
  const accommodationMapItems = useMemo(
    () => accommodations.map(toSearchAccommodationMapViewModel),
    [accommodations],
  );
  const pageInfo = visibleResult?.pageInfo;
  const errorMessage = query.isError ? toSearchErrorMessage(query.error) : null;
  const isErrorRetryable =
    query.isError &&
    typeof query.error === "object" &&
    query.error !== null &&
    "retryable" in query.error &&
    query.error.retryable === true;
  const totalPages = Math.max(
    0,
    Math.min(pageInfo?.totalPages ?? 0, SEARCH_PAGE_LIMIT),
  );
  const currentPage = clampResultPage(
    pageInfo?.currentPage ?? routeState.page,
    totalPages,
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (
        query.isFetching ||
        page === currentPage ||
        page < 0 ||
        page >= SEARCH_PAGE_LIMIT
      ) {
        return;
      }

      const targetRequestIdentity = searchRequestIdentity({
        ...request,
        page,
      });
      pendingBoundsRequestRef.current = targetRequestIdentity;
      navigation.openPage(page);
    },
    [currentPage, navigation, query.isFetching, request],
  );

  const handleMapBoundsChange = useCallback(
    (bounds: SearchMapBounds) => {
      suspendedBoundsRequestRef.current = null;
      navigation.replaceMapBounds(bounds);
    },
    [navigation],
  );

  const handleMapBoundsDragStart = useCallback(() => {
    suspendedBoundsRequestRef.current =
      pendingBoundsRequestRef.current === requestIdentity ||
      shouldUpdateMapBounds
        ? requestIdentity
        : null;
    pendingBoundsRequestRef.current = null;
    onMapBoundsUpdated();
    setUserDragRequestIdentity(requestIdentity);
  }, [onMapBoundsUpdated, requestIdentity, shouldUpdateMapBounds]);

  const handleMapBoundsDragCancel = useCallback(() => {
    const suspendedRequestIdentity = suspendedBoundsRequestRef.current;
    suspendedBoundsRequestRef.current = null;

    if (suspendedRequestIdentity === requestIdentity) {
      if (
        query.data &&
        !query.isError &&
        !query.isFetching &&
        !query.isPlaceholderData
      ) {
        requestMapBoundsUpdate();
      } else {
        pendingBoundsRequestRef.current = requestIdentity;
      }
    }

    setUserDragRequestIdentity((currentRequestIdentity) =>
      currentRequestIdentity === requestIdentity
        ? null
        : currentRequestIdentity,
    );
  }, [
    query.data,
    query.isError,
    query.isFetching,
    query.isPlaceholderData,
    requestIdentity,
    requestMapBoundsUpdate,
  ]);

  const openAccommodation = useCallback(
    (accommodationId: number) => {
      navigation.openAccommodation(accommodationId);
      selectAccommodationId(accommodationId);
    },
    [navigation, selectAccommodationId],
  );

  const toggleWishlist = useCallback(
    async (accommodationId: number) => {
      if (removingAccommodationIdsRef.current.has(accommodationId)) return;
      if (!isAuthenticated) {
        const attemptId = wishlistAuthIntent?.request(accommodationId) ?? null;
        pendingAuthAttemptIdRef.current = attemptId;
        setPendingWishlistAccommodationId(accommodationId);
        setAuthModalOpen(true);
        return;
      }

      const accommodation = accommodations.find(
        (item) => item.id === accommodationId,
      );
      setWishlistError(null);
      if (!accommodation?.isInWishlist) {
        setWishlistAccommodationId(accommodationId);
        return;
      }
      if (!wishlistMembership) return;

      const generation = wishlistGenerationRef.current;
      removingAccommodationIdsRef.current.add(accommodationId);
      setRemovingAccommodationIds(new Set(removingAccommodationIdsRef.current));
      try {
        const result =
          await wishlistMembership.commands.removeAccommodationFromAllWishlists(
            { accommodationId },
          );
        if (generation !== wishlistGenerationRef.current) return;
        if (result.status === "applied-unconfirmed") {
          setWishlistError(
            "저장 취소 후 최신 상태를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.",
          );
        }
      } catch (error) {
        if (generation === wishlistGenerationRef.current) {
          setWishlistError(toWishlistErrorMessage(error));
        }
      } finally {
        if (generation === wishlistGenerationRef.current) {
          removingAccommodationIdsRef.current.delete(accommodationId);
          setRemovingAccommodationIds(
            new Set(removingAccommodationIdsRef.current),
          );
        }
      }
    },
    [accommodations, isAuthenticated, wishlistAuthIntent, wishlistMembership],
  );

  const closeAuthModal = useCallback(() => {
    const attemptId = pendingAuthAttemptIdRef.current;
    pendingAuthAttemptIdRef.current = null;
    if (attemptId !== null) wishlistAuthIntent?.cancel(attemptId);

    setAuthModalOpen(false);
    setPendingWishlistAccommodationId(null);
  }, [wishlistAuthIntent]);

  const handleAuthSuccess = useCallback(() => {
    setAuthModalOpen(false);

    if (
      wishlistAuthIntent === undefined &&
      pendingWishlistAccommodationId !== null
    ) {
      setWishlistAccommodationId(pendingWishlistAccommodationId);
      setPendingWishlistAccommodationId(null);
    }
  }, [pendingWishlistAccommodationId, wishlistAuthIntent]);

  const closeWishlistModal = useCallback(() => {
    setWishlistAccommodationId(null);
  }, []);

  const retrySearch = useCallback(() => {
    void refetchSearchResults();
  }, [refetchSearchResults]);

  const canOpenWishlist =
    !query.isPlaceholderData && !query.isError && !isShowingRetainedResult;
  const wishlistModal =
    wishlistMembership && wishlistAccommodationId !== null
      ? {
          accommodationId: wishlistAccommodationId,
          commands: wishlistMembership.commands,
          onClose: closeWishlistModal,
          scope: wishlistMembership.scope,
        }
      : null;

  return (
    <SearchScreen
      authModal={{
        isOpen: authModalOpen,
        onClose: closeAuthModal,
        initialMode: "login",
        ...(wishlistAuthIntent === undefined
          ? { onSuccess: handleAuthSuccess }
          : {}),
      }}
      bottomSheet={bottomSheet}
      errorMessage={errorMessage}
      isErrorRetryable={isErrorRetryable}
      getAccommodationHref={navigation.getAccommodationHref}
      map={{
        boundsRequestKey: requestIdentity,
        handleAccommodationSelect,
        hoveredAccommodationId,
        isMapDragMode,
        isMapExpanded,
        onBoundsDragCancel: handleMapBoundsDragCancel,
        onBoundsDragStart: handleMapBoundsDragStart,
        onMapBoundsUpdated,
        requestBounds: handleMapBoundsChange,
        selectedAccommodationId,
        setHoveredAccommodationId,
        shouldUpdateMapBounds,
        toggleMapExpanded,
        viewport,
      }}
      onAccommodationOpen={openAccommodation}
      onPageChange={handlePageChange}
      onRetry={retrySearch}
      results={{
        accommodationCards,
        accommodationMapItems,
        currentPage,
        isLoading: query.isFetching && visibleResult === undefined,
        isPlaceholderData: query.isPlaceholderData || isShowingRetainedResult,
        isRefreshing: query.isFetching && visibleResult !== undefined,
        totalElements: pageInfo?.totalElements ?? 0,
        totalPages,
      }}
      wishlistModal={wishlistModal}
      removingAccommodationIds={removingAccommodationIds}
      wishlistError={
        wishlistError
          ? { message: wishlistError, onClose: () => setWishlistError(null) }
          : null
      }
      {...(routeState.checkIn === undefined
        ? {}
        : { checkIn: routeState.checkIn })}
      {...(routeState.checkOut === undefined
        ? {}
        : { checkOut: routeState.checkOut })}
      {...(canOpenWishlist
        ? { onWishlistToggle: (id: number) => void toggleWishlist(id) }
        : {})}
    />
  );
}
