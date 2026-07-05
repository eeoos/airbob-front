import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  toSearchAccommodationCardViewModel,
  toSearchAccommodationMapViewModel,
} from "../lib/searchAccommodationViewModel";
import { searchQueryKeys } from "../queryKeys";

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

const patchAccommodationWishlistStatus = (
  response: AccommodationSearchResponse,
  accommodationId: number,
  isInWishlist: boolean
): AccommodationSearchResponse => {
  let didUpdate = false;
  const staySearchResultListing = response.stay_search_result_listing.map(
    (accommodation) => {
      if (
        accommodation.id !== accommodationId ||
        accommodation.is_in_wishlist === isInWishlist
      ) {
        return accommodation;
      }

      didUpdate = true;
      return {
        ...accommodation,
        is_in_wishlist: isInWishlist,
      };
    }
  );

  return didUpdate
    ? {
        ...response,
        stay_search_result_listing: staySearchResultListing,
      }
    : response;
};

export const useSearchResults = ({
  searchParams,
  setSearchParams,
  handleError,
  clearError,
  setIsMapDragMode,
  requestMapBoundsUpdate,
}: UseSearchResultsOptions) => {
  const queryClient = useQueryClient();
  const isInitialLoadRef = useRef(true);
  const prevPageRef = useRef<number | null>(null);
  const prevSearchParamsRef = useRef("");
  const prevViewportRef = useRef<string | null>(null);
  const pendingPageResetRef = useRef<string | null>(null);
  const pendingScrollToTopRef = useRef<string | null>(null);
  const activeSearchParamsRef = useRef<string | null>(null);
  const handledErrorUpdatedAtRef = useRef(0);
  const [placeholderWishlistOverrides, setPlaceholderWishlistOverrides] =
    useState<Record<number, boolean>>({});
  const searchParamsString = searchParams.toString();
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
  const searchResultsQueryKey = useMemo(
    () => searchQueryKeys.results(searchParamsString),
    [searchParamsString]
  );

  const searchResultsQuery = useQuery<
    AccommodationSearchResponse,
    unknown,
    AccommodationSearchResponse,
    ReturnType<typeof searchQueryKeys.results>
  >({
    queryKey: searchResultsQueryKey,
    queryFn: ({ signal }) => {
      activeSearchParamsRef.current = searchParamsString;
      setIsMapDragMode(isMapDragMode);
      clearError();
      return accommodationApi.search(searchRequest, signal);
    },
    enabled: queryEnabled,
    placeholderData: keepPreviousData,
    throwOnError: false,
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
        requestMapBoundsUpdate();
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
    shouldFetch,
    shouldResetPage,
  ]);

  useEffect(() => {
    if (!searchResultsQuery.data || searchResultsQuery.isPlaceholderData) {
      return;
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
  ]);

  useEffect(() => {
    if (searchResultsQuery.isPlaceholderData) {
      return;
    }

    setPlaceholderWishlistOverrides((prev) =>
      Object.keys(prev).length > 0 ? {} : prev
    );
  }, [searchResultsQuery.dataUpdatedAt, searchResultsQuery.isPlaceholderData]);

  useEffect(() => {
    if (
      !searchResultsQuery.isError ||
      !searchResultsQuery.error ||
      handledErrorUpdatedAtRef.current === searchResultsQuery.errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current = searchResultsQuery.errorUpdatedAt;
    if (pendingScrollToTopRef.current === searchParamsString) {
      pendingScrollToTopRef.current = null;
    }
    handleError(searchResultsQuery.error);
  }, [
    handleError,
    searchParamsString,
    searchResultsQuery.error,
    searchResultsQuery.errorUpdatedAt,
    searchResultsQuery.isError,
  ]);

  const searchResponse = searchResultsQuery.data;
  const { currentPage, totalPages, totalElements } =
    getSearchPageInfo(searchResponse);
  const accommodations = useMemo(() => {
    const searchResultListing: AccommodationSearchInfo[] =
      searchResponse?.stay_search_result_listing ?? [];

    if (
      !searchResultsQuery.isPlaceholderData ||
      Object.keys(placeholderWishlistOverrides).length === 0
    ) {
      return searchResultListing;
    }

    return searchResultListing.map((accommodation) => {
      const isInWishlist = placeholderWishlistOverrides[accommodation.id];

      return isInWishlist === undefined
        ? accommodation
        : {
            ...accommodation,
            is_in_wishlist: isInWishlist,
          };
    });
  }, [
    placeholderWishlistOverrides,
    searchResponse?.stay_search_result_listing,
    searchResultsQuery.isPlaceholderData,
  ]);
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

  const updateAccommodationWishlistStatus = useCallback(
    (accommodationId: number, isInWishlist: boolean) => {
      queryClient.setQueriesData<AccommodationSearchResponse>(
        { queryKey: [...searchQueryKeys.all, "results"] },
        (
          prev: AccommodationSearchResponse | undefined
        ): AccommodationSearchResponse | undefined =>
          prev
            ? patchAccommodationWishlistStatus(
                prev,
                accommodationId,
                isInWishlist
              )
            : prev
      );

      if (searchResultsQuery.isPlaceholderData) {
        setPlaceholderWishlistOverrides((prev) => ({
          ...prev,
          [accommodationId]: isInWishlist,
        }));
      }
    },
    [queryClient, searchResultsQuery.isPlaceholderData]
  );

  const handleMapBoundsChange = useCallback((bounds: SearchViewport) => {
    const newParams = buildMapBoundsSearchParams(searchParams, bounds);
    prevPageRef.current = 0;
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handlePageChange = useCallback((page: number) => {
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

    pendingScrollToTopRef.current = newParams.toString();
    setSearchParams(newParams, { replace: false });
  }, [
    currentPage,
    isLoading,
    requestMapBoundsUpdate,
    searchParamsString,
    setSearchParams,
  ]);

  return {
    accommodations,
    accommodationCards,
    accommodationMapItems,
    updateAccommodationWishlistStatus,
    isLoading,
    currentPage,
    totalPages,
    totalElements,
    handleMapBoundsChange,
    handlePageChange,
  };
};
