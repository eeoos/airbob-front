import { useEffect, useRef } from "react";
import {
  getSearchBarUrlStateSignature,
  parseSearchBarUrlState,
} from "../lib/searchBarUrlState";
import type { SearchCommittedValues } from "../model/searchInteractionReducer";

interface SearchBarUrlSyncOptions {
  urlSearchParams: URLSearchParams;
  resetPlaces: () => void;
  syncAutocompleteInput: (value: string) => void;
  onCommittedChanged: (values: SearchCommittedValues) => void;
}

export const useSearchBarUrlSync = ({
  urlSearchParams,
  resetPlaces,
  syncAutocompleteInput,
  onCommittedChanged,
}: SearchBarUrlSyncOptions) => {
  const appliedSignatureRef = useRef<string | null>(null);
  const syncedDestinationRef = useRef<string | null>(null);
  const searchBarUrlStateSignature =
    getSearchBarUrlStateSignature(urlSearchParams);

  useEffect(() => {
    if (appliedSignatureRef.current === searchBarUrlStateSignature) {
      return;
    }

    const nextState = parseSearchBarUrlState(
      new URLSearchParams(searchBarUrlStateSignature),
    );

    if (syncedDestinationRef.current !== nextState.destination) {
      resetPlaces();
      syncAutocompleteInput(nextState.destination);
      syncedDestinationRef.current = nextState.destination;
    }

    onCommittedChanged(nextState);
    appliedSignatureRef.current = searchBarUrlStateSignature;
  }, [
    onCommittedChanged,
    resetPlaces,
    searchBarUrlStateSignature,
    syncAutocompleteInput,
  ]);
};
