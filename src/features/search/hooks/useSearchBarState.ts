import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePlacesAutocomplete } from "../../../hooks/usePlacesAutocomplete";
import {
  buildSearchNavigationParams,
  removeViewportParams,
  toSearchRouteQuery,
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

const SEARCH_BAR_URL_PARAM_KEYS = [
  "destination",
  "checkIn",
  "checkOut",
  "adultOccupancy",
  "childOccupancy",
  "infantOccupancy",
  "petOccupancy",
] as const;

const getSearchBarUrlStateSignature = (params: URLSearchParams) => {
  const nextParams = new URLSearchParams();

  SEARCH_BAR_URL_PARAM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value !== null) {
      nextParams.set(key, value);
    }
  });

  return nextParams.toString();
};

const parseDateParam = (value: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const parsePositiveInt = (value: string | null, fallback: number) => {
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeInt = (value: string | null, fallback: number) => {
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const parseSearchBarUrlState = (params: URLSearchParams) => ({
  destination: params.get("destination") ?? "",
  checkIn: parseDateParam(params.get("checkIn")),
  checkOut: parseDateParam(params.get("checkOut")),
  adultOccupancy: parsePositiveInt(params.get("adultOccupancy"), 1),
  childOccupancy: parseNonNegativeInt(params.get("childOccupancy"), 0),
  infantOccupancy: parseNonNegativeInt(params.get("infantOccupancy"), 0),
  petOccupancy: parseNonNegativeInt(params.get("petOccupancy"), 0),
});

const resolveCountUpdate = (
  nextValue: SetStateAction<number>,
  currentValue: number
) =>
  typeof nextValue === "function"
    ? (nextValue as (value: number) => number)(currentValue)
    : nextValue;

const clampCount = (value: number, min: number) =>
  Number.isFinite(value) ? Math.max(min, value) : min;

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
  const [adultOccupancy, setAdultOccupancyState] = useState(1);
  const [childOccupancy, setChildOccupancyState] = useState(0);
  const [infantOccupancy, setInfantOccupancyState] = useState(0);
  const [petOccupancy, setPetOccupancyState] = useState(0);
  const syncedDestinationRef = useRef<string | null>(null);
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

  const setAdultOccupancy: Dispatch<SetStateAction<number>> = useCallback(
    (nextValue) => {
      setAdultOccupancyState((currentValue) =>
        clampCount(resolveCountUpdate(nextValue, currentValue), 1)
      );
    },
    []
  );

  const setChildOccupancy: Dispatch<SetStateAction<number>> = useCallback(
    (nextValue) => {
      setChildOccupancyState((currentValue) =>
        clampCount(resolveCountUpdate(nextValue, currentValue), 0)
      );
    },
    []
  );

  const setInfantOccupancy: Dispatch<SetStateAction<number>> = useCallback(
    (nextValue) => {
      setInfantOccupancyState((currentValue) =>
        clampCount(resolveCountUpdate(nextValue, currentValue), 0)
      );
    },
    []
  );

  const setPetOccupancy: Dispatch<SetStateAction<number>> = useCallback(
    (nextValue) => {
      setPetOccupancyState((currentValue) =>
        clampCount(resolveCountUpdate(nextValue, currentValue), 0)
      );
    },
    []
  );

  const setExpanded = useCallback(
    (nextIsExpanded: boolean) => {
      setIsExpanded(nextIsExpanded);
      onExpandedChange?.(nextIsExpanded);
    },
    [onExpandedChange],
  );

  const completeCheckoutIfNeeded = useCallback(() => {
    if (!checkIn || checkOut) {
      return;
    }

    const nextDay = new Date(checkIn);
    nextDay.setDate(nextDay.getDate() + 1);
    setCheckOut(nextDay);
  }, [checkIn, checkOut]);

  const closeTransientPanels = useCallback(
    ({
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
    },
    [checkIn, checkOut, completeCheckoutIfNeeded, setExpanded, showDatePicker],
  );

  const handleSearch = useCallback(
    (e?: { stopPropagation?: () => void }) => {
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

      const params = buildSearchNavigationParams(urlSearchParams, {
        destination: inputText || undefined,
        selectedPlace: isPlaceSelected ? selectedPlace : null,
        checkIn,
        checkOut,
        adultOccupancy,
        childOccupancy,
        infantOccupancy,
        petOccupancy,
      });

      navigate(routeTo.search(toSearchRouteQuery(params)));
    },
    [
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
    ],
  );

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

  const handleDateSelect = useCallback(
    (newCheckIn: Date | null, newCheckOut: Date | null) => {
      if (
        newCheckIn &&
        newCheckOut &&
        newCheckOut.getTime() < newCheckIn.getTime()
      ) {
        setCheckIn(newCheckOut);
        setCheckOut(newCheckIn);
        return;
      }

      setCheckIn(newCheckIn);
      setCheckOut(newCheckOut);
    },
    [],
  );

  const getTotalGuests = useCallback(
    () => adultOccupancy + childOccupancy,
    [adultOccupancy, childOccupancy],
  );

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

    setCheckIn(nextState.checkIn);
    setCheckOut(nextState.checkOut);
    setAdultOccupancyState(nextState.adultOccupancy);
    setChildOccupancyState(nextState.childOccupancy);
    setInfantOccupancyState(nextState.infantOccupancy);
    setPetOccupancyState(nextState.petOccupancy);
  }, [handleInputChange, resetPlaces, searchBarUrlStateSignature]);

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
