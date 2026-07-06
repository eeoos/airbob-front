import { useCallback } from "react";
import { useApiError } from "../../../hooks/useApiError";
import { useAuth } from "../../../hooks/useAuth";
import { routeTo } from "../../../routes/paths";
import { toAccommodationBookingRouteQuery } from "../lib/accommodationDetailParams";
import { useSearchBottomSheet } from "./useSearchBottomSheet";
import { useSearchMapState } from "./useSearchMapState";
import { useSearchResults } from "./useSearchResults";
import { useSearchWishlistModal } from "./useSearchWishlistModal";

type SetSearchParams = (
  nextParams: URLSearchParams,
  options?: { replace?: boolean }
) => void;

interface UseSearchRouteControllerOptions {
  openWindow?: (url: string, target: string) => Window | null;
  searchParams: URLSearchParams;
  setSearchParams: SetSearchParams;
}

export const useSearchRouteController = ({
  openWindow = window.open,
  searchParams,
  setSearchParams,
}: UseSearchRouteControllerOptions) => {
  const { error, handleError, clearError } = useApiError();
  const { isAuthenticated } = useAuth();
  const mapState = useSearchMapState();
  const { selectAccommodationId } = mapState;
  const searchResults = useSearchResults({
    searchParams,
    setSearchParams,
    handleError,
    clearError,
    setIsMapDragMode: mapState.setIsMapDragMode,
    requestMapBoundsUpdate: mapState.requestMapBoundsUpdate,
  });
  const bottomSheet = useSearchBottomSheet();
  const wishlist = useSearchWishlistModal({
    isAuthenticated,
    onWishlistStatusChange: searchResults.updateAccommodationWishlistStatus,
  });

  const openAccommodationDetail = useCallback(
    (accommodationId: number) => {
      const detailParams = toAccommodationBookingRouteQuery(searchParams);

      openWindow(
        routeTo.accommodationDetail(accommodationId, detailParams),
        "_blank"
      );
      selectAccommodationId(accommodationId);
    },
    [openWindow, searchParams, selectAccommodationId]
  );

  return {
    bottomSheet,
    checkIn: searchParams.get("checkIn"),
    checkOut: searchParams.get("checkOut"),
    clearError,
    error,
    hasResults: searchResults.accommodationCards.length > 0,
    mapState,
    openAccommodationDetail,
    searchResults,
    wishlist,
  };
};
