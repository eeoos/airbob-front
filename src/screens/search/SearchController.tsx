import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WishlistMembershipCommandPort } from "../../features/wishlist/ports/wishlistMembershipCommandPort";
import type { WishlistModalProps } from "../../features/wishlist/components/WishlistModal";
import type { SearchMapBounds } from "../../features/search/components/SearchMap/types";
import {
  toSearchAccommodationCardViewModel,
  toSearchAccommodationMapViewModel,
} from "../../features/search/lib/searchAccommodationViewModel";
import {
  SEARCH_PAGE_LIMIT,
  toSearchRequest,
} from "../../features/search/lib/searchRequest";
import type { SearchCommittedRouteState } from "../../features/search/model/search";
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
  readonly scrollResultsToTop: () => void;
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

const viewportIdentity = (viewport: SearchMapBounds | null): string | null =>
  viewport
    ? `${viewport.north},${viewport.west},${viewport.south},${viewport.east}`
    : null;

const searchRequestIdentity = (
  request: ReturnType<typeof toSearchRequest>,
): string => JSON.stringify(request);

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
  const viewport = useMemo(() => toViewport(routeState), [routeState]);
  const isMapDragMode =
    viewport !== null && routeState.destination === undefined;
  const currentViewportIdentity = viewportIdentity(viewport);
  const previousViewportIdentityRef = useRef<string | null | undefined>(
    undefined,
  );
  const pendingScrollRequestRef = useRef<string | null>(null);
  const pendingBoundsRequestRef = useRef<string | null>(null);
  const pendingAuthAttemptIdRef = useRef<number | null>(null);
  const handledResumeAttemptRef = useRef<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingWishlistAccommodationId, setPendingWishlistAccommodationId] =
    useState<number | null>(null);
  const [wishlistAccommodationId, setWishlistAccommodationId] = useState<
    number | null
  >(null);

  const requestIdentity = useMemo(
    () => searchRequestIdentity(request),
    [request],
  );

  useEffect(() => {
    setErrorMessage(null);

    if (pendingScrollRequestRef.current !== requestIdentity) {
      pendingScrollRequestRef.current = null;
    }
    if (pendingBoundsRequestRef.current !== requestIdentity) {
      pendingBoundsRequestRef.current = null;
    }
  }, [requestIdentity, scope.epoch, scope.subject]);

  useEffect(() => {
    if (!query.isError) return;

    pendingScrollRequestRef.current = null;
    pendingBoundsRequestRef.current = null;
    setErrorMessage(toSearchErrorMessage(query.error));
  }, [query.error, query.errorUpdatedAt, query.isError]);

  useEffect(() => {
    const previousViewportIdentity = previousViewportIdentityRef.current;
    previousViewportIdentityRef.current = currentViewportIdentity;

    if (previousViewportIdentity === currentViewportIdentity) return;

    pendingBoundsRequestRef.current =
      currentViewportIdentity === null ? null : requestIdentity;
  }, [currentViewportIdentity, requestIdentity]);

  useEffect(() => {
    if (
      !query.data ||
      query.isError ||
      query.isPlaceholderData ||
      query.isFetching
    ) {
      return;
    }

    setErrorMessage(null);

    if (pendingBoundsRequestRef.current === requestIdentity) {
      pendingBoundsRequestRef.current = null;
      requestMapBoundsUpdate();
    }

    if (pendingScrollRequestRef.current === requestIdentity) {
      pendingScrollRequestRef.current = null;
      navigation.scrollResultsToTop();
    }
  }, [
    navigation,
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
    setWishlistAccommodationId(null);
  }, [wishlistMembership?.scope.epoch, wishlistMembership?.scope.subject]);

  const accommodations = useMemo(
    () => query.data?.accommodations ?? [],
    [query.data?.accommodations],
  );
  const accommodationCards = useMemo(
    () => accommodations.map(toSearchAccommodationCardViewModel),
    [accommodations],
  );
  const accommodationMapItems = useMemo(
    () => accommodations.map(toSearchAccommodationMapViewModel),
    [accommodations],
  );
  const pageInfo = query.data?.pageInfo;
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
      pendingScrollRequestRef.current = targetRequestIdentity;
      pendingBoundsRequestRef.current = targetRequestIdentity;
      navigation.openPage(page);
    },
    [currentPage, navigation, query.isFetching, request],
  );

  const handleMapBoundsChange = useCallback(
    (bounds: SearchMapBounds) => {
      navigation.replaceMapBounds(bounds);
    },
    [navigation],
  );

  const openAccommodation = useCallback(
    (accommodationId: number) => {
      navigation.openAccommodation(accommodationId);
      selectAccommodationId(accommodationId);
    },
    [navigation, selectAccommodationId],
  );

  const openWishlist = useCallback(
    (accommodationId: number) => {
      if (!isAuthenticated) {
        const attemptId = wishlistAuthIntent?.request(accommodationId) ?? null;
        pendingAuthAttemptIdRef.current = attemptId;
        setPendingWishlistAccommodationId(accommodationId);
        setAuthModalOpen(true);
        return;
      }

      setWishlistAccommodationId(accommodationId);
    },
    [isAuthenticated, wishlistAuthIntent],
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

  const canOpenWishlist = !query.isPlaceholderData;
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
      getAccommodationHref={navigation.getAccommodationHref}
      map={{
        handleAccommodationSelect,
        hoveredAccommodationId,
        isMapDragMode,
        isMapExpanded,
        onMapBoundsUpdated,
        requestBounds: handleMapBoundsChange,
        selectedAccommodationId,
        setHoveredAccommodationId,
        shouldUpdateMapBounds,
        toggleMapExpanded,
        viewport,
      }}
      onAccommodationOpen={openAccommodation}
      onClearError={() => setErrorMessage(null)}
      onPageChange={handlePageChange}
      results={{
        accommodationCards,
        accommodationMapItems,
        currentPage,
        isLoading: query.isFetching,
        isPlaceholderData: query.isPlaceholderData,
        totalElements: pageInfo?.totalElements ?? 0,
        totalPages,
      }}
      wishlistModal={wishlistModal}
      {...(routeState.checkIn === undefined
        ? {}
        : { checkIn: routeState.checkIn })}
      {...(routeState.checkOut === undefined
        ? {}
        : { checkOut: routeState.checkOut })}
      {...(canOpenWishlist ? { onWishlistToggle: openWishlist } : {})}
    />
  );
}
