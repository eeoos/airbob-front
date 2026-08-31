import { useCallback, useMemo, useReducer } from "react";
import { usePlacesAutocomplete } from "./usePlacesAutocomplete";
import type { SearchParams } from "../lib/searchBarContracts";
import { parseSearchBarUrlState } from "../lib/searchBarUrlState";
import { removeViewportParams } from "../lib/searchParams";
import type {
  SearchPlacePrediction,
  SearchSelectedPlace,
} from "../model/search";
import {
  createSearchInteractionState,
  searchInteractionReducer,
  type SearchCommittedValues,
  type SearchGuestKey,
} from "../model/searchInteractionReducer";
import { useSearchBarSearch } from "./useSearchBarSearch";
import { useSearchBarUrlSync } from "./useSearchBarUrlSync";

export interface SearchBarRoutePort {
  readonly currentSearchParams: URLSearchParams;
  readonly isSearchRoute: boolean;
  pushSearch(searchParams: URLSearchParams): void;
  replaceSearch(searchParams: URLSearchParams): void;
}

interface UseSearchBarStateOptions {
  routePort: SearchBarRoutePort;
  onSearch?: (searchParams: SearchParams) => void;
  isMapDragMode?: boolean;
}

export const useSearchBarState = ({
  routePort,
  onSearch,
  isMapDragMode = false,
}: UseSearchBarStateOptions) => {
  const { currentSearchParams } = routePort;
  const [interaction, dispatch] = useReducer(
    searchInteractionReducer,
    parseSearchBarUrlState(currentSearchParams),
    createSearchInteractionState,
  );
  const commitSelectedPlace = useCallback((place: SearchSelectedPlace) => {
    dispatch({ type: "destinationSelected", place });
  }, []);
  const places = usePlacesAutocomplete({
    debounceMs: 250,
    onPlaceSelect: commitSelectedPlace,
  });
  const {
    handleInputChange: syncAutocompleteInput,
    handlePlaceSelect: requestPlaceSelection,
    isLoading: isPlacesLoading,
    reset: resetPlaces,
    startNewSession: startDestinationSession,
    suggestions,
  } = places;

  const committedChanged = useCallback((values: SearchCommittedValues) => {
    dispatch({ type: "committedChanged", values });
  }, []);

  useSearchBarUrlSync({
    urlSearchParams: currentSearchParams,
    resetPlaces,
    syncAutocompleteInput,
    onCommittedChanged: committedChanged,
  });

  const changeDestination = useCallback(
    (value: string) => {
      dispatch({ type: "destinationTextChanged", value });
      syncAutocompleteInput(value);
    },
    [syncAutocompleteInput],
  );

  const clearDestinationSelection = useCallback(() => {
    resetPlaces();
    dispatch({ type: "destinationSelectionCleared" });
  }, [resetPlaces]);

  const selectDestination = useCallback(
    (prediction: SearchPlacePrediction) => {
      dispatch({
        type: "destinationTextChanged",
        value: prediction.description,
      });
      void requestPlaceSelection(prediction);
    },
    [requestPlaceSelection],
  );

  const setGuestCount = useCallback((guest: SearchGuestKey, value: number) => {
    dispatch({
      type: "guestCountChanged",
      guest,
      value,
    });
  }, []);

  const changeAdultOccupancy = useCallback(
    (value: number) => setGuestCount("adultOccupancy", value),
    [setGuestCount],
  );
  const changeChildOccupancy = useCallback(
    (value: number) => setGuestCount("childOccupancy", value),
    [setGuestCount],
  );
  const changeInfantOccupancy = useCallback(
    (value: number) => setGuestCount("infantOccupancy", value),
    [setGuestCount],
  );
  const changePetOccupancy = useCallback(
    (value: number) => setGuestCount("petOccupancy", value),
    [setGuestCount],
  );

  const expandShell = useCallback(() => {
    dispatch({ type: "shellExpanded" });
  }, []);
  const collapseShell = useCallback(() => {
    dispatch({ type: "shellCollapsed" });
  }, []);
  const openDestination = useCallback(() => {
    dispatch({ type: "popoverOpened", popover: "destination" });
  }, []);
  const openDatePicker = useCallback(() => {
    dispatch({ type: "popoverOpened", popover: "date" });
  }, []);
  const toggleGuestPicker = useCallback(() => {
    dispatch({ type: "popoverToggled", popover: "guests" });
  }, []);
  const closeActivePopover = useCallback(() => {
    dispatch({ type: "popoverClosed" });
  }, []);
  const startComposition = useCallback(() => {
    dispatch({ type: "compositionStarted" });
  }, []);
  const endComposition = useCallback(() => {
    dispatch({ type: "compositionEnded" });
  }, []);
  const handleDateSelect = useCallback(
    (checkIn: Date | null, checkOut: Date | null) => {
      dispatch({ type: "dateRangeChanged", checkIn, checkOut });
    },
    [],
  );
  const completeCheckoutIfNeeded = useCallback(() => {
    dispatch({ type: "checkoutCompleted" });
  }, []);

  const closeTransientPanels = useCallback(
    ({
      collapseWhenDateSelected = false,
    }: { collapseWhenDateSelected?: boolean } = {}) => {
      if (interaction.activePopover === "date") {
        dispatch({ type: "checkoutCompleted" });
      }

      dispatch({ type: "popoverClosed" });

      if (
        collapseWhenDateSelected &&
        (interaction.draft.checkIn || interaction.draft.checkOut)
      ) {
        dispatch({ type: "shellCollapsed" });
      }
    },
    [
      interaction.activePopover,
      interaction.draft.checkIn,
      interaction.draft.checkOut,
    ],
  );

  const handleSearch = useSearchBarSearch({
    inputText: interaction.draft.destinationText,
    selectedPlace: interaction.draft.selectedPlace,
    checkIn: interaction.draft.checkIn,
    checkOut: interaction.draft.checkOut,
    adultOccupancy: interaction.draft.adultOccupancy,
    childOccupancy: interaction.draft.childOccupancy,
    infantOccupancy: interaction.draft.infantOccupancy,
    petOccupancy: interaction.draft.petOccupancy,
    urlSearchParams: currentSearchParams,
    pushSearch: routePort.pushSearch,
    closeTransientPanels,
    isPlacesLoading,
    ...(onSearch === undefined ? {} : { onSearch }),
  });

  const exitMapDragMode = useCallback(() => {
    if (isMapDragMode && routePort.isSearchRoute) {
      routePort.replaceSearch(removeViewportParams(currentSearchParams));
    }
  }, [currentSearchParams, isMapDragMode, routePort]);

  const destination = useMemo(
    () => ({
      inputText: interaction.draft.destinationText,
      suggestions,
      selectedPlace: interaction.draft.selectedPlace,
    }),
    [
      interaction.draft.destinationText,
      interaction.draft.selectedPlace,
      suggestions,
    ],
  );

  const dates = useMemo(
    () => ({
      checkIn: interaction.draft.checkIn,
      checkOut: interaction.draft.checkOut,
    }),
    [interaction.draft.checkIn, interaction.draft.checkOut],
  );

  const guests = useMemo(
    () => ({
      adultOccupancy: interaction.draft.adultOccupancy,
      childOccupancy: interaction.draft.childOccupancy,
      infantOccupancy: interaction.draft.infantOccupancy,
      petOccupancy: interaction.draft.petOccupancy,
      totalGuests:
        interaction.draft.adultOccupancy + interaction.draft.childOccupancy,
    }),
    [
      interaction.draft.adultOccupancy,
      interaction.draft.childOccupancy,
      interaction.draft.infantOccupancy,
      interaction.draft.petOccupancy,
    ],
  );

  const popover = useMemo(
    () => ({
      activePopover: interaction.activePopover,
      isExpanded: interaction.shell === "expanded",
      isComposing: interaction.composition === "composing",
      showGuestPicker: interaction.activePopover === "guests",
      showDatePicker: interaction.activePopover === "date",
      showSuggestions: interaction.activePopover === "destination",
    }),
    [interaction.activePopover, interaction.composition, interaction.shell],
  );

  const actions = useMemo(
    () => ({
      changeAdultOccupancy,
      changeChildOccupancy,
      changeInfantOccupancy,
      changePetOccupancy,
      expandShell,
      collapseShell,
      openDestination,
      openDatePicker,
      toggleGuestPicker,
      closeActivePopover,
      startComposition,
      endComposition,
      changeDestination,
      selectDestination,
      clearDestinationSelection,
      startDestinationSession,
      handleSearch,
      exitMapDragMode,
      completeCheckoutIfNeeded,
      closeTransientPanels,
      handleDateSelect,
    }),
    [
      changeAdultOccupancy,
      changeChildOccupancy,
      changeDestination,
      changeInfantOccupancy,
      changePetOccupancy,
      clearDestinationSelection,
      closeActivePopover,
      closeTransientPanels,
      collapseShell,
      completeCheckoutIfNeeded,
      endComposition,
      exitMapDragMode,
      expandShell,
      handleDateSelect,
      handleSearch,
      openDatePicker,
      openDestination,
      selectDestination,
      startDestinationSession,
      startComposition,
      toggleGuestPicker,
    ],
  );

  const status = useMemo(() => ({ isPlacesLoading }), [isPlacesLoading]);

  return { destination, dates, guests, popover, actions, status };
};
