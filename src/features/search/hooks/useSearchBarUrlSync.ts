import { useEffect, useRef } from "react";
import {
  getSearchBarUrlStateSignature,
  parseSearchBarUrlState,
} from "../lib/searchBarUrlState";
import type { SearchBarGuestCounts } from "./useSearchBarGuests";

interface SearchBarUrlSyncOptions {
  urlSearchParams: URLSearchParams;
  resetPlaces: () => void;
  handleInputChange: (value: string) => void;
  setDateRange: (checkIn: Date | null, checkOut: Date | null) => void;
  setGuestCounts: (counts: SearchBarGuestCounts) => void;
}

export const useSearchBarUrlSync = ({
  urlSearchParams,
  resetPlaces,
  handleInputChange,
  setDateRange,
  setGuestCounts,
}: SearchBarUrlSyncOptions) => {
  const syncedDestinationRef = useRef<string | null>(null);
  const searchBarUrlStateSignature =
    getSearchBarUrlStateSignature(urlSearchParams);

  useEffect(() => {
    const nextState = parseSearchBarUrlState(
      new URLSearchParams(searchBarUrlStateSignature),
    );

    if (syncedDestinationRef.current !== nextState.destination) {
      resetPlaces();
      handleInputChange(nextState.destination);
      syncedDestinationRef.current = nextState.destination;
    }

    setDateRange(nextState.checkIn, nextState.checkOut);
    setGuestCounts({
      adultOccupancy: nextState.adultOccupancy,
      childOccupancy: nextState.childOccupancy,
      infantOccupancy: nextState.infantOccupancy,
      petOccupancy: nextState.petOccupancy,
    });
  }, [
    handleInputChange,
    resetPlaces,
    searchBarUrlStateSignature,
    setDateRange,
    setGuestCounts,
  ]);
};
