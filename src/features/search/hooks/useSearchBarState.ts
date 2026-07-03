import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePlacesAutocomplete } from "../../../hooks/usePlacesAutocomplete";
import {
  buildSearchNavigationParams,
  removeViewportParams,
} from "../lib/searchParams";
import { ROUTE_PATHS, routeTo } from "../../../routes/paths";

export interface SearchParams {
  destination?: string;
  lat?: number;
  lng?: number;
  viewport?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  checkIn?: Date;
  checkOut?: Date;
  adultOccupancy?: number;
  childOccupancy?: number;
  infantOccupancy?: number;
  petOccupancy?: number;
}

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
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [adultOccupancy, setAdultOccupancy] = useState(1);
  const [childOccupancy, setChildOccupancy] = useState(0);
  const [infantOccupancy, setInfantOccupancy] = useState(0);
  const [petOccupancy, setPetOccupancy] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isOpeningDatePicker, setIsOpeningDatePicker] = useState(false);
  const [isOpeningGuestPicker, setIsOpeningGuestPicker] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  const setExpanded = useCallback((nextIsExpanded: boolean) => {
    setIsExpanded(nextIsExpanded);
    onExpandedChange?.(nextIsExpanded);
  }, [onExpandedChange]);

  const completeCheckoutIfNeeded = useCallback(() => {
    if (!checkIn || checkOut) {
      return;
    }

    const nextDay = new Date(checkIn);
    nextDay.setDate(nextDay.getDate() + 1);
    setCheckOut(nextDay);
  }, [checkIn, checkOut]);

  const closeTransientPanels = useCallback(({
    collapseWhenDateSelected = false,
  }: { collapseWhenDateSelected?: boolean } = {}) => {
    if (showDatePicker) {
      completeCheckoutIfNeeded();
    }

    setShowDatePicker(false);
    setShowGuestPicker(false);
    setShowSuggestions(false);

    if (collapseWhenDateSelected && (checkIn || checkOut)) {
      setExpanded(false);
    }
  }, [
    checkIn,
    checkOut,
    completeCheckoutIfNeeded,
    setExpanded,
    showDatePicker,
  ]);

  const handleSearch = useCallback((e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    closeTransientPanels();

    const isPlaceSelected = !!(
      selectedPlace &&
      Number.isFinite(selectedPlace.lat) &&
      Number.isFinite(selectedPlace.lng) &&
      selectedPlace.viewport
    );

    const searchParams: SearchParams = {
      destination: inputText || undefined,
      lat: isPlaceSelected ? selectedPlace.lat : undefined,
      lng: isPlaceSelected ? selectedPlace.lng : undefined,
      viewport: isPlaceSelected ? selectedPlace.viewport : undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      adultOccupancy,
      childOccupancy,
      infantOccupancy,
      petOccupancy,
    };

    if (onSearch) {
      onSearch(searchParams);
      return;
    }

    const params = buildSearchNavigationParams(
      urlSearchParams,
      {
        destination: inputText || undefined,
        selectedPlace: isPlaceSelected ? selectedPlace : null,
        checkIn,
        checkOut,
        adultOccupancy,
        childOccupancy,
        infantOccupancy,
        petOccupancy,
      }
    );

    navigate(routeTo.search(params));
  }, [
    adultOccupancy,
    checkIn,
    checkOut,
    childOccupancy,
    closeTransientPanels,
    infantOccupancy,
    inputText,
    navigate,
    onSearch,
    petOccupancy,
    selectedPlace,
    urlSearchParams,
  ]);

  const exitMapDragMode = useCallback(() => {
    if (isMapDragMode && location.pathname === ROUTE_PATHS.search) {
      const newParams = removeViewportParams(urlSearchParams);
      setUrlSearchParams(newParams, { replace: true });
    }
  }, [isMapDragMode, location.pathname, setUrlSearchParams, urlSearchParams]);

  const openDatePicker = useCallback(() => {
    if (!isExpanded) {
      setExpanded(true);
    }

    setIsOpeningDatePicker(true);

    if (!showDatePicker) {
      setShowDatePicker(true);
    }

    setShowGuestPicker(false);

    setTimeout(() => {
      setIsOpeningDatePicker(false);
    }, 500);
  }, [isExpanded, setExpanded, showDatePicker]);

  const toggleGuestPicker = useCallback(() => {
    if (!isExpanded) {
      setExpanded(true);
    }

    setIsOpeningGuestPicker(true);
    setShowGuestPicker(!showGuestPicker);
    setShowDatePicker(false);

    setTimeout(() => {
      setIsOpeningGuestPicker(false);
    }, 500);
  }, [isExpanded, setExpanded, showGuestPicker]);

  const handleDateSelect = useCallback((
    newCheckIn: Date | null,
    newCheckOut: Date | null
  ) => {
    setCheckIn(newCheckIn);
    setCheckOut(newCheckOut);
  }, []);

  const getTotalGuests = useCallback(
    () => adultOccupancy + childOccupancy,
    [adultOccupancy, childOccupancy]
  );

  useEffect(() => {
    const destination = urlSearchParams.get("destination");
    const checkInParam = urlSearchParams.get("checkIn");
    const checkOutParam = urlSearchParams.get("checkOut");
    const adultOccupancyParam = urlSearchParams.get("adultOccupancy");
    const childOccupancyParam = urlSearchParams.get("childOccupancy");
    const infantOccupancyParam = urlSearchParams.get("infantOccupancy");
    const petOccupancyParam = urlSearchParams.get("petOccupancy");

    if (destination && !inputText) {
      handleInputChange(destination);
    }

    if (checkInParam) {
      const checkInDate = new Date(checkInParam);
      if (!isNaN(checkInDate.getTime())) {
        setCheckIn(checkInDate);
      }
    }

    if (checkOutParam) {
      const checkOutDate = new Date(checkOutParam);
      if (!isNaN(checkOutDate.getTime())) {
        setCheckOut(checkOutDate);
      }
    }

    if (adultOccupancyParam) {
      const adult = parseInt(adultOccupancyParam, 10);
      if (!isNaN(adult) && adult > 0) {
        setAdultOccupancy(adult);
      }
    }

    if (childOccupancyParam) {
      const child = parseInt(childOccupancyParam, 10);
      if (!isNaN(child) && child >= 0) {
        setChildOccupancy(child);
      }
    }

    if (infantOccupancyParam) {
      const infant = parseInt(infantOccupancyParam, 10);
      if (!isNaN(infant) && infant >= 0) {
        setInfantOccupancy(infant);
      }
    }

    if (petOccupancyParam) {
      const pet = parseInt(petOccupancyParam, 10);
      if (!isNaN(pet) && pet >= 0) {
        setPetOccupancy(pet);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    checkIn,
    checkOut,
    adultOccupancy,
    childOccupancy,
    infantOccupancy,
    petOccupancy,
    isExpanded,
    showGuestPicker,
    showDatePicker,
    isComposing,
    isOpeningDatePicker,
    isOpeningGuestPicker,
    showSuggestions,
    inputText,
    suggestions,
    isPlacesLoading,
    selectedPlace,
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
    getTotalGuests,
  };
};
