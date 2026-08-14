import { useCallback, useRef } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { SearchPlaceSelection } from "../lib/searchParams";
import {
  buildSearchNavigationParams,
  toSearchRouteQuery,
} from "../lib/searchParams";
import { routeTo } from "../../../routes/paths";
import type { SearchParams } from "../lib/searchBarContracts";

interface SearchBarSearchEvent {
  stopPropagation?: () => void;
}

interface UseSearchBarSearchOptions {
  inputText: string;
  selectedPlace: SearchPlaceSelection | null;
  checkIn: Date | null;
  checkOut: Date | null;
  adultOccupancy: number;
  childOccupancy: number;
  infantOccupancy: number;
  petOccupancy: number;
  urlSearchParams: URLSearchParams;
  onSearch?: (searchParams: SearchParams) => void;
  navigate: NavigateFunction;
  closeTransientPanels: () => void;
  isPlacesLoading?: boolean;
}

export const useSearchBarSearch = ({
  inputText,
  selectedPlace,
  checkIn,
  checkOut,
  adultOccupancy,
  childOccupancy,
  infantOccupancy,
  petOccupancy,
  urlSearchParams,
  onSearch,
  navigate,
  closeTransientPanels,
  isPlacesLoading = false,
}: UseSearchBarSearchOptions) => {
  const lastSearchKeyRef = useRef<string | null>(null);

  return useCallback(
    (event?: SearchBarSearchEvent) => {
      event?.stopPropagation?.();

      if (isPlacesLoading) {
        return;
      }

      const validSelectedPlace: SearchPlaceSelection | null =
        selectedPlace &&
        Number.isFinite(selectedPlace.lat) &&
        Number.isFinite(selectedPlace.lng) &&
        selectedPlace.viewport
          ? selectedPlace
          : null;

      const searchParams: SearchParams = {
        destination: inputText || undefined,
        lat: validSelectedPlace?.lat,
        lng: validSelectedPlace?.lng,
        viewport: validSelectedPlace?.viewport,
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
        adultOccupancy,
        childOccupancy,
        infantOccupancy,
        petOccupancy,
      };

      if (onSearch) {
        const searchKey = JSON.stringify(searchParams);
        if (lastSearchKeyRef.current === searchKey) {
          return;
        }

        lastSearchKeyRef.current = searchKey;
        closeTransientPanels();
        onSearch(searchParams);
        return;
      }

      const params = buildSearchNavigationParams(urlSearchParams, {
        destination: inputText || undefined,
        selectedPlace: validSelectedPlace,
        checkIn,
        checkOut,
        adultOccupancy,
        childOccupancy,
        infantOccupancy,
        petOccupancy,
      });

      const nextPath = routeTo.search(toSearchRouteQuery(params));
      if (lastSearchKeyRef.current === nextPath) {
        return;
      }

      lastSearchKeyRef.current = nextPath;
      closeTransientPanels();
      navigate(nextPath);
    },
    [
      adultOccupancy,
      checkIn,
      checkOut,
      childOccupancy,
      closeTransientPanels,
      isPlacesLoading,
      infantOccupancy,
      inputText,
      navigate,
      onSearch,
      petOccupancy,
      selectedPlace,
      urlSearchParams,
    ],
  );
};
