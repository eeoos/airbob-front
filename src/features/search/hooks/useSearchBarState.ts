import { useCallback, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePlacesAutocomplete } from "../../../hooks/usePlacesAutocomplete";
import { removeViewportParams } from "../lib/searchParams";
import { ROUTE_PATHS } from "../../../routes/paths";
import { useSearchBarDates } from "./useSearchBarDates";
import { useSearchBarGuests } from "./useSearchBarGuests";
import { useSearchBarPopoverState } from "./useSearchBarPopoverState";
import { useSearchBarSearch } from "./useSearchBarSearch";
import { useSearchBarUrlSync } from "./useSearchBarUrlSync";
import type { SearchParams } from "../lib/searchBarContracts";

export type { SearchParams } from "../lib/searchBarContracts";

interface UseSearchBarStateOptions {
  onSearch?: (searchParams: SearchParams) => void;
  onExpandedChange?: (isExpanded: boolean) => void;
  isMapDragMode?: boolean;
}

export const useSearchBarState = ({
  onSearch,
  onExpandedChange,
  isMapDragMode = false,
}: UseSearchBarStateOptions = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const {
    checkIn,
    checkOut,
    completeCheckoutIfNeeded,
    handleDateSelect,
    setDateRange,
  } = useSearchBarDates();
  const {
    adultOccupancy,
    childOccupancy,
    infantOccupancy,
    petOccupancy,
    getTotalGuests,
    setAdultOccupancy,
    setChildOccupancy,
    setGuestCounts,
    setInfantOccupancy,
    setPetOccupancy,
  } = useSearchBarGuests();
  const {
    isExpanded,
    showGuestPicker,
    showDatePicker,
    isComposing,
    isOpeningDatePicker,
    isOpeningGuestPicker,
    showSuggestions,
    setExpanded,
    setShowGuestPicker,
    setShowDatePicker,
    setIsComposing,
    setIsOpeningDatePicker,
    setIsOpeningGuestPicker,
    setShowSuggestions,
    closeTransientPanels,
    openDatePicker,
    toggleGuestPicker,
  } = useSearchBarPopoverState({
    onExpandedChange,
    checkIn,
    checkOut,
    completeCheckoutIfNeeded,
  });

  const {
    inputText,
    suggestions,
    isLoading: isPlacesLoading,
    selectedPlace,
    handleInputChange,
    handlePlaceSelect,
    reset: resetPlaces,
    startNewSession,
  } = usePlacesAutocomplete({
    debounceMs: 250,
    onPlaceSelect: () => {
      setShowSuggestions(false);
    },
  });

  const handleSearch = useSearchBarSearch({
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
    isPlacesLoading,
  });

  const exitMapDragMode = useCallback(() => {
    if (isMapDragMode && location.pathname === ROUTE_PATHS.search) {
      const newParams = removeViewportParams(urlSearchParams);
      setUrlSearchParams(newParams, { replace: true });
    }
  }, [isMapDragMode, location.pathname, setUrlSearchParams, urlSearchParams]);

  useSearchBarUrlSync({
    urlSearchParams,
    resetPlaces,
    handleInputChange,
    setDateRange,
    setGuestCounts,
  });

  const destination = useMemo(
    () => ({
      inputText,
      suggestions,
      selectedPlace,
    }),
    [inputText, selectedPlace, suggestions],
  );

  const dates = useMemo(
    () => ({
      checkIn,
      checkOut,
    }),
    [checkIn, checkOut],
  );

  const guests = useMemo(
    () => ({
      adultOccupancy,
      childOccupancy,
      infantOccupancy,
      petOccupancy,
      getTotalGuests,
    }),
    [
      adultOccupancy,
      childOccupancy,
      getTotalGuests,
      infantOccupancy,
      petOccupancy,
    ],
  );

  const popover = useMemo(
    () => ({
      isExpanded,
      showGuestPicker,
      showDatePicker,
      isComposing,
      isOpeningDatePicker,
      isOpeningGuestPicker,
      showSuggestions,
    }),
    [
      isComposing,
      isExpanded,
      isOpeningDatePicker,
      isOpeningGuestPicker,
      showDatePicker,
      showGuestPicker,
      showSuggestions,
    ],
  );

  const actions = useMemo(
    () => ({
      setAdultOccupancy,
      setChildOccupancy,
      setInfantOccupancy,
      setPetOccupancy,
      setExpanded,
      setShowGuestPicker,
      setShowDatePicker,
      setIsComposing,
      setIsOpeningDatePicker,
      setIsOpeningGuestPicker,
      setShowSuggestions,
      handleInputChange,
      handlePlaceSelect,
      resetPlaces,
      startNewSession,
      handleSearch,
      exitMapDragMode,
      completeCheckoutIfNeeded,
      closeTransientPanels,
      openDatePicker,
      toggleGuestPicker,
      handleDateSelect,
    }),
    [
      closeTransientPanels,
      completeCheckoutIfNeeded,
      exitMapDragMode,
      handleDateSelect,
      handleInputChange,
      handlePlaceSelect,
      handleSearch,
      openDatePicker,
      resetPlaces,
      setAdultOccupancy,
      setChildOccupancy,
      setExpanded,
      setInfantOccupancy,
      setIsComposing,
      setIsOpeningDatePicker,
      setIsOpeningGuestPicker,
      setPetOccupancy,
      setShowDatePicker,
      setShowGuestPicker,
      setShowSuggestions,
      startNewSession,
      toggleGuestPicker,
    ],
  );

  const status = useMemo(
    () => ({
      isPlacesLoading,
    }),
    [isPlacesLoading],
  );

  return {
    destination,
    dates,
    guests,
    popover,
    actions,
    status,
  };
};
