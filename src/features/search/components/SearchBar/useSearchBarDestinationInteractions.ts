import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent } from "react";

interface SearchBarDomRef<T extends HTMLElement = HTMLElement> {
  readonly current: T | null;
}

interface UseSearchBarDestinationInteractionsOptions {
  destinationInputRef: SearchBarDomRef<HTMLInputElement>;
  suggestionsRef: SearchBarDomRef;
  datePickerRef: SearchBarDomRef;
  guestPickerRef: SearchBarDomRef;
  datePickerElementRef: SearchBarDomRef;
  inputText: string;
  isExpanded: boolean;
  isMapDragMode: boolean;
  showDatePicker: boolean;
  showGuestPicker: boolean;
  isOpeningDatePicker: boolean;
  isOpeningGuestPicker: boolean;
  exitMapDragMode: () => void;
  handleInputChange: (value: string) => void;
  setExpanded: (isExpanded: boolean) => void;
  setShowDatePicker: (value: boolean) => void;
  setShowGuestPicker: (value: boolean) => void;
  setShowSuggestions: (value: boolean) => void;
  setIsOpeningDatePicker: (value: boolean) => void;
  startNewSession: () => void;
  completeCheckoutIfNeeded: () => void;
}

export interface SearchBarDestinationInteractions {
  handleDestinationClick: (event: MouseEvent) => void;
  handleDestinationChange: (value: string) => void;
  handleDestinationFocus: () => void;
  handleDestinationEnterWithoutSuggestion: () => void;
  handleDestinationBlur: () => void;
}

export const useSearchBarDestinationInteractions = ({
  destinationInputRef,
  suggestionsRef,
  datePickerRef,
  guestPickerRef,
  datePickerElementRef,
  inputText,
  isExpanded,
  isMapDragMode,
  showDatePicker,
  showGuestPicker,
  isOpeningDatePicker,
  isOpeningGuestPicker,
  exitMapDragMode,
  handleInputChange,
  setExpanded,
  setShowDatePicker,
  setShowGuestPicker,
  setShowSuggestions,
  setIsOpeningDatePicker,
  startNewSession,
  completeCheckoutIfNeeded,
}: UseSearchBarDestinationInteractionsOptions): SearchBarDestinationInteractions => {
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef({
    isOpeningDatePicker,
    isOpeningGuestPicker,
    showDatePicker,
    showGuestPicker,
  });
  stateRef.current = {
    isOpeningDatePicker,
    isOpeningGuestPicker,
    showDatePicker,
    showGuestPicker,
  };

  const clearInteractionTimers = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearInteractionTimers, [clearInteractionTimers]);

  const handleDestinationClick = useCallback(
    (event: MouseEvent) => {
      clearInteractionTimers();
      event.stopPropagation();

      if (showDatePicker || showGuestPicker) {
        if (showDatePicker) {
          completeCheckoutIfNeeded();
        }
        setShowDatePicker(false);
        setShowGuestPicker(false);
      }

      exitMapDragMode();

      if (!isExpanded) {
        setExpanded(true);
        startNewSession();
        setTimeout(() => {
          destinationInputRef.current?.focus();
          if (inputText.trim()) {
            setShowSuggestions(true);
          }
        }, 0);
      } else {
        destinationInputRef.current?.focus();
        if (inputText.trim()) {
          setShowSuggestions(true);
        }
      }
    },
    [
      completeCheckoutIfNeeded,
      clearInteractionTimers,
      destinationInputRef,
      exitMapDragMode,
      inputText,
      isExpanded,
      setExpanded,
      setShowDatePicker,
      setShowGuestPicker,
      setShowSuggestions,
      showDatePicker,
      showGuestPicker,
      startNewSession,
    ],
  );

  const handleDestinationChange = useCallback(
    (value: string) => {
      if (isMapDragMode) {
        exitMapDragMode();
      }

      handleInputChange(value);
    },
    [exitMapDragMode, handleInputChange, isMapDragMode],
  );

  const handleDestinationFocus = useCallback(() => {
    clearInteractionTimers();

    if (isMapDragMode) {
      exitMapDragMode();
      handleInputChange("");
    }

    setShowDatePicker(false);
    setShowGuestPicker(false);
    setShowSuggestions(true);
  }, [
    clearInteractionTimers,
    exitMapDragMode,
    handleInputChange,
    isMapDragMode,
    setShowDatePicker,
    setShowGuestPicker,
    setShowSuggestions,
  ]);

  const handleDestinationEnterWithoutSuggestion = useCallback(() => {
    clearInteractionTimers();

    if (!isExpanded) {
      return;
    }

    setIsOpeningDatePicker(true);
    setShowDatePicker(true);
    setShowGuestPicker(false);
    setShowSuggestions(false);

    enterTimerRef.current = setTimeout(() => {
      enterTimerRef.current = null;
      destinationInputRef.current?.blur();
      setIsOpeningDatePicker(false);
    }, 100);
  }, [
    clearInteractionTimers,
    destinationInputRef,
    isExpanded,
    setIsOpeningDatePicker,
    setShowDatePicker,
    setShowGuestPicker,
    setShowSuggestions,
  ]);

  const handleDestinationBlur = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
    }

    blurTimerRef.current = setTimeout(() => {
      blurTimerRef.current = null;
      const activeElement = document.activeElement;
      if (suggestionsRef.current?.contains(activeElement as Node)) {
        return;
      }

      const isClickingDatePicker = datePickerElementRef.current?.contains(
        activeElement as Node,
      );
      const isClickingGuestPicker = guestPickerRef.current?.contains(
        activeElement as Node,
      );
      const isClickingDateArea = datePickerRef.current?.contains(
        activeElement as Node,
      );
      const isClickingGuestArea = guestPickerRef.current?.contains(
        activeElement as Node,
      );
      const {
        isOpeningDatePicker: isOpeningDatePickerNow,
        isOpeningGuestPicker: isOpeningGuestPickerNow,
        showDatePicker: showDatePickerNow,
        showGuestPicker: showGuestPickerNow,
      } = stateRef.current;

      setShowSuggestions(false);

      if (
        !isOpeningDatePickerNow &&
        !isOpeningGuestPickerNow &&
        !showDatePickerNow &&
        !showGuestPickerNow &&
        !isClickingDatePicker &&
        !isClickingGuestPicker &&
        !isClickingDateArea &&
        !isClickingGuestArea
      ) {
        setExpanded(false);
      }
    }, 100);
  }, [
    datePickerElementRef,
    datePickerRef,
    guestPickerRef,
    setExpanded,
    setShowSuggestions,
    suggestionsRef,
  ]);

  return {
    handleDestinationClick,
    handleDestinationChange,
    handleDestinationFocus,
    handleDestinationEnterWithoutSuggestion,
    handleDestinationBlur,
  };
};
