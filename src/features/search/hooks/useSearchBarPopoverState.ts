import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface SearchBarPopoverState {
  isExpanded: boolean;
  showGuestPicker: boolean;
  showDatePicker: boolean;
  isComposing: boolean;
  isOpeningDatePicker: boolean;
  isOpeningGuestPicker: boolean;
  showSuggestions: boolean;
  setExpanded: (isExpanded: boolean) => void;
  setShowGuestPicker: Dispatch<SetStateAction<boolean>>;
  setShowDatePicker: Dispatch<SetStateAction<boolean>>;
  setIsComposing: Dispatch<SetStateAction<boolean>>;
  setIsOpeningDatePicker: Dispatch<SetStateAction<boolean>>;
  setIsOpeningGuestPicker: Dispatch<SetStateAction<boolean>>;
  setShowSuggestions: Dispatch<SetStateAction<boolean>>;
  closeTransientPanels: (options?: {
    collapseWhenDateSelected?: boolean;
  }) => void;
  openDatePicker: () => void;
  toggleGuestPicker: () => void;
}

interface UseSearchBarPopoverStateOptions {
  onExpandedChange?: (isExpanded: boolean) => void;
  checkIn: Date | null;
  checkOut: Date | null;
  completeCheckoutIfNeeded: () => void;
}

export const useSearchBarPopoverState = ({
  onExpandedChange,
  checkIn,
  checkOut,
  completeCheckoutIfNeeded,
}: UseSearchBarPopoverStateOptions): SearchBarPopoverState => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isOpeningDatePicker, setIsOpeningDatePicker] = useState(false);
  const [isOpeningGuestPicker, setIsOpeningGuestPicker] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dateOpeningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestOpeningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (dateOpeningTimerRef.current) {
      clearTimeout(dateOpeningTimerRef.current);
    }
    if (guestOpeningTimerRef.current) {
      clearTimeout(guestOpeningTimerRef.current);
    }
  }, []);

  const setExpanded = useCallback(
    (nextIsExpanded: boolean) => {
      setIsExpanded(nextIsExpanded);
      onExpandedChange?.(nextIsExpanded);
    },
    [onExpandedChange],
  );

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
    [
      checkIn,
      checkOut,
      completeCheckoutIfNeeded,
      setExpanded,
      showDatePicker,
    ],
  );

  const openDatePicker = useCallback(() => {
    if (!isExpanded) {
      setExpanded(true);
    }

    setIsOpeningDatePicker(true);

    if (dateOpeningTimerRef.current) {
      clearTimeout(dateOpeningTimerRef.current);
    }

    if (!showDatePicker) {
      setShowDatePicker(true);
    }

    setShowGuestPicker(false);

    dateOpeningTimerRef.current = setTimeout(() => {
      dateOpeningTimerRef.current = null;
      setIsOpeningDatePicker(false);
    }, 500);
  }, [isExpanded, setExpanded, showDatePicker]);

  const toggleGuestPicker = useCallback(() => {
    if (!isExpanded) {
      setExpanded(true);
    }

    setIsOpeningGuestPicker(true);

    if (guestOpeningTimerRef.current) {
      clearTimeout(guestOpeningTimerRef.current);
    }
    setShowGuestPicker(!showGuestPicker);
    setShowDatePicker(false);

    guestOpeningTimerRef.current = setTimeout(() => {
      guestOpeningTimerRef.current = null;
      setIsOpeningGuestPicker(false);
    }, 500);
  }, [isExpanded, setExpanded, showGuestPicker]);

  return {
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
  };
};
