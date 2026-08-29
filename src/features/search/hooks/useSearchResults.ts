import { useCallback, useEffect, useMemo, useRef } from "react";
import { useHandledQueryError } from "../../../query/useHandledQueryError";
import {
  AccommodationSearchInfo,
  AccommodationSearchRequest,
  AccommodationSearchResponse,
} from "../../../types/accommodation";
import {
  clampSearchPage,
  getLimitedTotalPages,
} from "../lib/pagination";
import {
  buildSearchRequestFromParams,
  getSearchParamsSignature,
  getViewportSearchParamSignature,
} from "../lib/searchParams";
import {
  toSearchAccommodationCardViewModel,
  toSearchAccommodationMapViewModel,
} from "../lib/searchAccommodationViewModel";
import { useSearchResultsNavigation } from "./useSearchResultsNavigation";
import { useSearchResultsQuery } from "./useSearchResultsQuery";

type SetSearchParams = (
  nextParams: URLSearchParams,
  options?: { replace?: boolean }
) => void;

interface UseSearchResultsOptions {
  searchParams: URLSearchParams;
  setSearchParams: SetSearchParams;
  handleError: (error: unknown) => unknown;
  clearError: () => void;
  setIsMapDragMode: (isMapDragMode: boolean) => void;
  requestMapBoundsUpdate: () => void;
}

const getParamsWithoutPage = (params: string) => {
  const nextParams = new URLSearchParams(params);
  nextParams.delete("page");
  return nextParams;
};

const getSearchPageInfo = (response?: AccommodationSearchResponse) => {
  if (!response) {
    return {
      currentPage: 0,
      totalPages: 0,
      totalElements: 0,
    };
  }

  const limitedTotalPages = getLimitedTotalPages(response.page_info.total_pages);
  const limitedCurrentPage = Math.max(
    0,
    Math.min(response.page_info.current_page, limitedTotalPages - 1)
  );

  return {
    currentPage: limitedCurrentPage,
    totalPages: limitedTotalPages,
    totalElements: response.page_info.total_elements,
  };
};

export const useSearchResults = ({
  searchParams,
  setSearchParams,
  handleError,
  clearError,
  setIsMapDragMode,
  requestMapBoundsUpdate,
}: UseSearchResultsOptions) => {
  const isInitialLoadRef = useRef(true);
  const prevPageRef = useRef<number | null>(null);
  const prevSearchParamsRef = useRef("");
  const prevViewportRef = useRef<string | null>(null);
  const pendingPageResetRef = useRef<string | null>(null);
  const pendingScrollToTopRef = useRef<string | null>(null);
  const pendingMapBoundsUpdateRef = useRef<string | null>(null);
  const activeSearchParamsRef = useRef<string | null>(null);
  const searchParamsString = searchParams.toString();
  const searchParamsSignature = useMemo(
    () => getSearchParamsSignature(new URLSearchParams(searchParamsString)),
    [searchParamsString],
  );
  const page = clampSearchPage(searchParams.get("page"));
  const prevPageParam = prevSearchParamsRef.current
    ? new URLSearchParams(prevSearchParamsRef.current).get("page")
    : null;
  const prevPage = clampSearchPage(prevPageParam);
  const isPageChanged =
    prevPageRef.current !== null && prevPageRef.current !== page;
  const isOnlyPageChanged =
    prevPage !== page &&
    getParamsWithoutPage(prevSearchParamsRef.current).toString() ===
      getParamsWithoutPage(searchParamsString).toString();
  const prevParams = getParamsWithoutPage(prevSearchParamsRef.current);
  const currentParams = getParamsWithoutPage(searchParamsString);
  const isSearchParamsChanged =
    prevParams.toString() !== currentParams.toString();
  const isViewportChanged =
    prevParams.get("topLeftLat") !== currentParams.get("topLeftLat") ||
    prevParams.get("topLeftLng") !== currentParams.get("topLeftLng") ||
    prevParams.get("bottomRightLat") !== currentParams.get("bottomRightLat") ||
    prevParams.get("bottomRightLng") !== currentParams.get("bottomRightLng");
  const prevDestination = prevParams.get("destination");
  const currentDestination = currentParams.get("destination");
  const isDestinationChanged = prevDestination !== currentDestination;
  const isMapDragMode = isViewportChanged && !currentParams.get("destination");
  const currentViewportString = getViewportSearchParamSignature(searchParams);
  const hasViewportForMap = !!currentViewportString;
  const resetParams = useMemo(() => {
    const nextParams = new URLSearchParams(searchParamsString);
    nextParams.delete("page");
    return nextParams;
  }, [searchParamsString]);
  const shouldResetPage =
    isDestinationChanged &&
    !isPageChanged &&
    resetParams.toString() !== searchParamsString;
  const shouldFetch =
    isInitialLoadRef.current ||
    (isPageChanged && isOnlyPageChanged && !isMapDragMode) ||
    isSearchParamsChanged ||
    (isMapDragMode && isViewportChanged);
  const isPendingPageReset = pendingPageResetRef.current === searchParamsString;
  const queryEnabled =
    !isPendingPageReset &&
    !shouldResetPage &&
    (shouldFetch || activeSearchParamsRef.current === searchParamsString);
  const searchRequest = useMemo<AccommodationSearchRequest>(
    () => buildSearchRequestFromParams(searchParams, { page }),
    [page, searchParams]
  );
  const handleSearchQueryStart = useCallback(() => {
    activeSearchParamsRef.current = searchParamsString;
    setIsMapDragMode(isMapDragMode);
    clearError();
  }, [clearError, isMapDragMode, searchParamsString, setIsMapDragMode]);

  const scheduleMapBoundsUpdate = useCallback(
    (targetSearchParamsString = searchParamsString) => {
      pendingMapBoundsUpdateRef.current = targetSearchParamsString;
    },
    [searchParamsString],
  );

  const searchResultsQuery = useSearchResultsQuery({
    enabled: queryEnabled,
    onQueryStart: handleSearchQueryStart,
    searchParamsSignature,
    searchRequest,
  });

  useEffect(() => {
    const currentSearchParams = searchParamsString;

    if (pendingPageResetRef.current === currentSearchParams) {
      return;
    }

    if (pendingPageResetRef.current !== null) {
      pendingPageResetRef.current = null;
    }

    if (
      pendingScrollToTopRef.current !== null &&
      pendingScrollToTopRef.current !== currentSearchParams
    ) {
      pendingScrollToTopRef.current = null;
    }

    if (hasViewportForMap) {
      if (prevViewportRef.current !== currentViewportString) {
        scheduleMapBoundsUpdate(currentSearchParams);
        prevViewportRef.current = currentViewportString;
      }
    } else {
      prevViewportRef.current = null;
    }

    if (!shouldFetch) {
      prevPageRef.current = page;
      prevSearchParamsRef.current = currentSearchParams;
      return;
    }

    if (shouldResetPage) {
      pendingPageResetRef.current = currentSearchParams;
      setSearchParams(resetParams, { replace: true });
      prevPageRef.current = 0;
      prevSearchParamsRef.current = resetParams.toString();
      return;
    }

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
    }

    prevPageRef.current = page;
    prevSearchParamsRef.current = currentSearchParams;
  }, [
    currentViewportString,
    hasViewportForMap,
    page,
    requestMapBoundsUpdate,
    resetParams,
    searchParamsString,
    setSearchParams,
    scheduleMapBoundsUpdate,
    shouldFetch,
    shouldResetPage,
  ]);

  useEffect(() => {
    if (!searchResultsQuery.data || searchResultsQuery.isPlaceholderData) {
      return;
    }

    if (pendingMapBoundsUpdateRef.current === searchParamsString) {
      pendingMapBoundsUpdateRef.current = null;
      requestMapBoundsUpdate();
    }

    activeSearchParamsRef.current = searchParamsString;
    const { currentPage: limitedCurrentPage } = getSearchPageInfo(
      searchResultsQuery.data
    );
    prevPageRef.current = limitedCurrentPage;
    prevSearchParamsRef.current = searchParamsString;

    if (pendingScrollToTopRef.current === searchParamsString) {
      pendingScrollToTopRef.current = null;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [
    searchParamsString,
    searchResultsQuery.data,
    searchResultsQuery.dataUpdatedAt,
    searchResultsQuery.isPlaceholderData,
    requestMapBoundsUpdate,
  ]);

  const handleSearchResultsError = useCallback((queryError: unknown) => {
    if (pendingScrollToTopRef.current === searchParamsString) {
      pendingScrollToTopRef.current = null;
    }
    handleError(queryError);
  }, [handleError, searchParamsString]);

  useHandledQueryError({
    error: searchResultsQuery.error,
    errorUpdatedAt: searchResultsQuery.errorUpdatedAt,
    isError: searchResultsQuery.isError,
    onError: handleSearchResultsError,
  });

  const searchResponse = searchResultsQuery.data;
  const { currentPage, totalPages, totalElements } =
    getSearchPageInfo(searchResponse);
  const accommodations = useMemo<AccommodationSearchInfo[]>(
    () => searchResponse?.stay_search_result_listing ?? [],
    [searchResponse?.stay_search_result_listing],
  );
  const accommodationCards = useMemo(
    () => accommodations.map(toSearchAccommodationCardViewModel),
    [accommodations],
  );
  const accommodationMapItems = useMemo(
    () => accommodations.map(toSearchAccommodationMapViewModel),
    [accommodations],
  );
  const isLoading = queryEnabled
    ? searchResultsQuery.isFetching
    : isInitialLoadRef.current || isPendingPageReset;

  const setPreviousPage = useCallback((nextPage: number) => {
    prevPageRef.current = nextPage;
  }, []);

  const setPendingScrollToTop = useCallback((nextSearchParams: string) => {
    pendingScrollToTopRef.current = nextSearchParams;
  }, []);

  const { handleMapBoundsChange, handlePageChange } =
    useSearchResultsNavigation({
      searchParams,
      searchParamsString,
      currentPage,
      isLoading,
      setSearchParams,
      requestMapBoundsUpdate: scheduleMapBoundsUpdate,
      setPreviousPage,
      setPendingScrollToTop,
    });

  return {
    accommodations,
    accommodationCards,
    accommodationMapItems,
    isPlaceholderData: searchResultsQuery.isPlaceholderData,
    isLoading,
    currentPage,
    totalPages,
    totalElements,
    handleMapBoundsChange,
    handlePageChange,
  };
};
