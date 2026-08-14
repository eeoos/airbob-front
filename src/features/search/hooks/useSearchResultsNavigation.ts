import { useCallback } from "react";
import { MAX_SEARCH_PAGE } from "../lib/pagination";
import {
  SearchViewport,
  buildMapBoundsSearchParams,
} from "../lib/searchParams";

type SetSearchParams = (
  nextParams: URLSearchParams,
  options?: { replace?: boolean },
) => void;

interface UseSearchResultsNavigationOptions {
  searchParams: URLSearchParams;
  searchParamsString: string;
  currentPage: number;
  isLoading: boolean;
  setSearchParams: SetSearchParams;
  requestMapBoundsUpdate: (searchParamsString?: string) => void;
  setPreviousPage: (page: number) => void;
  setPendingScrollToTop?: (searchParams: string) => void;
}

export const useSearchResultsNavigation = ({
  searchParams,
  searchParamsString,
  currentPage,
  isLoading,
  setSearchParams,
  requestMapBoundsUpdate,
  setPreviousPage,
  setPendingScrollToTop,
}: UseSearchResultsNavigationOptions) => {
  const handleMapBoundsChange = useCallback(
    (bounds: SearchViewport) => {
      const newParams = buildMapBoundsSearchParams(searchParams, bounds);
      setPreviousPage(0);
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setPreviousPage, setSearchParams],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (page === currentPage || isLoading) {
        return;
      }

      if (page >= MAX_SEARCH_PAGE) {
        return;
      }

      const newParams = new URLSearchParams(searchParamsString);
      if (page === 0) {
        newParams.delete("page");
      } else {
        newParams.set("page", page.toString());
      }

      requestMapBoundsUpdate(newParams.toString());
      setPendingScrollToTop?.(newParams.toString());
      setSearchParams(newParams, { replace: false });
    },
    [
      currentPage,
      isLoading,
      requestMapBoundsUpdate,
      searchParamsString,
      setPendingScrollToTop,
      setSearchParams,
    ],
  );

  return {
    handleMapBoundsChange,
    handlePageChange,
  };
};
