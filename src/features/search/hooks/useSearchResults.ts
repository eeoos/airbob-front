import { useCallback, useEffect, useRef, useState } from "react";
import { accommodationApi } from "../../../api";
import {
  AccommodationSearchInfo,
  AccommodationSearchRequest,
  AccommodationSearchResponse,
} from "../../../types/accommodation";
import {
  MAX_SEARCH_PAGE,
  clampSearchPage,
  getLimitedTotalPages,
} from "../lib/pagination";
import {
  SearchViewport,
  buildMapBoundsSearchParams,
  buildSearchRequestFromParams,
  getViewportSearchParamSignature,
} from "../lib/searchParams";

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

const applySearchPageInfo = (
  response: AccommodationSearchResponse,
  setTotalPages: (totalPages: number) => void,
  setTotalElements: (totalElements: number) => void,
  setCurrentPage: (currentPage: number) => void
) => {
  const limitedTotalPages = getLimitedTotalPages(response.page_info.total_pages);
  setTotalPages(limitedTotalPages);
  setTotalElements(response.page_info.total_elements);

  const limitedCurrentPage = Math.max(
    0,
    Math.min(response.page_info.current_page, limitedTotalPages - 1)
  );
  setCurrentPage(limitedCurrentPage);

  return limitedCurrentPage;
};

export const useSearchResults = ({
  searchParams,
  setSearchParams,
  handleError,
  clearError,
  setIsMapDragMode,
  requestMapBoundsUpdate,
}: UseSearchResultsOptions) => {
  const [accommodations, setAccommodations] = useState<
    AccommodationSearchInfo[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const isInitialLoadRef = useRef(true);
  const prevPageRef = useRef<number | null>(null);
  const prevSearchParamsRef = useRef("");
  const prevViewportRef = useRef<string | null>(null);
  const pendingPageResetRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const searchParamsString = searchParams.toString();

  const applySearchResponse = useCallback((
    response: AccommodationSearchResponse,
    paramsSignature: string
  ) => {
    setAccommodations(response.stay_search_result_listing);
    const limitedCurrentPage = applySearchPageInfo(
      response,
      setTotalPages,
      setTotalElements,
      setCurrentPage
    );
    prevPageRef.current = limitedCurrentPage;
    prevSearchParamsRef.current = paramsSignature;
  }, []);

  const updateAccommodationWishlistStatus = useCallback(
    (accommodationId: number, isInWishlist: boolean) => {
      setAccommodations((prev) =>
        prev.map((accommodation) =>
          accommodation.id === accommodationId
            ? { ...accommodation, is_in_wishlist: isInWishlist }
            : accommodation
        )
      );
    },
    []
  );

  const fetchAccommodations = useCallback(async (
    params: AccommodationSearchRequest,
    isMapDrag = false,
    paramsSignature = searchParamsString
  ) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsMapDragMode(isMapDrag);
    setIsLoading(true);
    clearError();

    if (!isMapDrag && params.page !== undefined) {
      setCurrentPage(params.page);
    } else {
      setCurrentPage(0);
    }

    try {
      const response = await accommodationApi.search(params);
      if (requestIdRef.current !== requestId) return;
      applySearchResponse(response, paramsSignature);
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      handleError(error);
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [
    applySearchResponse,
    clearError,
    handleError,
    searchParamsString,
    setIsMapDragMode,
  ]);

  useEffect(() => {
    const currentSearchParams = searchParamsString;

    if (pendingPageResetRef.current === currentSearchParams) {
      return;
    }

    if (pendingPageResetRef.current !== null) {
      pendingPageResetRef.current = null;
    }

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
        getParamsWithoutPage(currentSearchParams).toString();

    const prevParams = getParamsWithoutPage(prevSearchParamsRef.current);
    const currentParams = getParamsWithoutPage(currentSearchParams);
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
    const isMapDragMode =
      isViewportChanged && !currentParams.get("destination");
    const currentViewportString = getViewportSearchParamSignature(searchParams);
    const hasViewportForMap = !!currentViewportString;

    if (hasViewportForMap) {
      if (prevViewportRef.current !== currentViewportString) {
        requestMapBoundsUpdate();
        prevViewportRef.current = currentViewportString;
      }
    } else {
      prevViewportRef.current = null;
    }

    const shouldFetch =
      isInitialLoadRef.current ||
      (isPageChanged && isOnlyPageChanged && !isMapDragMode) ||
      isSearchParamsChanged ||
      (isMapDragMode && isViewportChanged);

    if (!shouldFetch) {
      prevPageRef.current = page;
      prevSearchParamsRef.current = currentSearchParams;
      return;
    }

    if (isDestinationChanged && !isPageChanged) {
      const resetParams = new URLSearchParams(currentSearchParams);
      resetParams.delete("page");
      if (resetParams.toString() !== currentSearchParams) {
        pendingPageResetRef.current = currentSearchParams;
        setSearchParams(resetParams, { replace: true });
        prevPageRef.current = 0;
        prevSearchParamsRef.current = resetParams.toString();
        return;
      }
    }

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
    }

    prevPageRef.current = page;
    prevSearchParamsRef.current = currentSearchParams;

    const params = buildSearchRequestFromParams(searchParams, { page });
    fetchAccommodations(params, isMapDragMode, currentSearchParams);
  }, [
    fetchAccommodations,
    requestMapBoundsUpdate,
    searchParams,
    searchParamsString,
    setSearchParams,
  ]);

  const handleMapBoundsChange = useCallback((bounds: SearchViewport) => {
    const newParams = buildMapBoundsSearchParams(searchParams, bounds);
    prevPageRef.current = 0;
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handlePageChange = useCallback(async (page: number) => {
    if (page === currentPage || isLoading) {
      return;
    }

    if (page >= MAX_SEARCH_PAGE) {
      return;
    }

    requestMapBoundsUpdate();

    const newParams = new URLSearchParams(searchParamsString);
    if (page === 0) {
      newParams.delete("page");
    } else {
      newParams.set("page", page.toString());
    }

    prevPageRef.current = page;
    prevSearchParamsRef.current = newParams.toString();
    setSearchParams(newParams, { replace: false });
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    clearError();

    try {
      const params = buildSearchRequestFromParams(searchParams, { page });
      const response = await accommodationApi.search(params);
      if (requestIdRef.current !== requestId) return;
      applySearchResponse(response, newParams.toString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      handleError(error);
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [
    applySearchResponse,
    clearError,
    currentPage,
    handleError,
    isLoading,
    requestMapBoundsUpdate,
    searchParams,
    searchParamsString,
    setSearchParams,
  ]);

  return {
    accommodations,
    updateAccommodationWishlistStatus,
    isLoading,
    currentPage,
    totalPages,
    totalElements,
    handleMapBoundsChange,
    handlePageChange,
  };
};
