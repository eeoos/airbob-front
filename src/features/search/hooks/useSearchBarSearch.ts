import { useCallback, useRef } from "react";
import { buildSearchNavigationParams } from "../lib/searchParams";
import type { SearchParams } from "../lib/searchBarContracts";
import type { SearchPlaceSelection } from "../model/search";

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
  pushSearch: (searchParams: URLSearchParams) => void;
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
  pushSearch,
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
        adultOccupancy,
        childOccupancy,
        infantOccupancy,
        petOccupancy,
        ...(inputText ? { destination: inputText } : {}),
        ...(validSelectedPlace
          ? {
              lat: validSelectedPlace.lat,
              lng: validSelectedPlace.lng,
              viewport: validSelectedPlace.viewport,
            }
          : {}),
        ...(checkIn === null ? {} : { checkIn }),
        ...(checkOut === null ? {} : { checkOut }),
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
        selectedPlace: validSelectedPlace,
        checkIn,
        checkOut,
        adultOccupancy,
        childOccupancy,
        infantOccupancy,
        petOccupancy,
        ...(inputText ? { destination: inputText } : {}),
      });

      const nextSearchKey = params.toString();
      if (lastSearchKeyRef.current === nextSearchKey) {
        return;
      }

      lastSearchKeyRef.current = nextSearchKey;
      closeTransientPanels();
      pushSearch(params);
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
      onSearch,
      petOccupancy,
      pushSearch,
      selectedPlace,
      urlSearchParams,
    ],
  );
};
