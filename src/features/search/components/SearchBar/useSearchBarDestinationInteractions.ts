import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { SearchActivePopover } from "../../model/searchInteractionReducer";

interface SearchBarDomRef<T extends HTMLElement = HTMLElement> {
  readonly current: T | null;
}

interface UseSearchBarDestinationInteractionsOptions {
  destinationInputRef: SearchBarDomRef<HTMLInputElement>;
  suggestionsRef: SearchBarDomRef;
  datePickerRef: SearchBarDomRef;
  guestPickerRef: SearchBarDomRef;
  datePickerElementRef: SearchBarDomRef;
  isExpanded: boolean;
  isMapDragMode: boolean;
  activePopover: SearchActivePopover;
  exitMapDragMode: () => void;
  changeDestination: (value: string) => void;
  openDestination: () => void;
  openDatePicker: () => void;
  closeActivePopover: () => void;
  collapseShell: () => void;
  startDestinationSession: () => void;
  completeCheckoutIfNeeded: () => void;
}

export interface SearchBarDestinationInteractions {
  handleDestinationClick: (event: MouseEvent) => void;
  handleDestinationChange: (value: string) => void;
  handleDestinationFocus: () => void;
  handleDestinationEnterWithoutSuggestion: () => void;
  handleDestinationBlur: () => void;
  handleDestinationEscape: () => void;
}

export const useSearchBarDestinationInteractions = ({
  destinationInputRef,
  suggestionsRef,
  datePickerRef,
  guestPickerRef,
  datePickerElementRef,
  isExpanded,
  isMapDragMode,
  activePopover,
  exitMapDragMode,
  changeDestination,
  openDestination,
  openDatePicker,
  closeActivePopover,
  collapseShell,
  startDestinationSession,
  completeCheckoutIfNeeded,
}: UseSearchBarDestinationInteractionsOptions): SearchBarDestinationInteractions => {
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePopoverRef = useRef(activePopover);
  activePopoverRef.current = activePopover;

  const clearInteractionTimers = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearInteractionTimers, [clearInteractionTimers]);

  const focusDestination = useCallback(() => {
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
    }

    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;
      destinationInputRef.current?.focus();
    }, 0);
  }, [destinationInputRef]);

  const handleDestinationClick = useCallback(
    (event: MouseEvent) => {
      clearInteractionTimers();
      event.stopPropagation();

      if (activePopover === "date") {
        completeCheckoutIfNeeded();
      }

      exitMapDragMode();
      openDestination();

      if (!isExpanded) {
        focusDestination();
      } else {
        destinationInputRef.current?.focus();
      }
    },
    [
      activePopover,
      clearInteractionTimers,
      completeCheckoutIfNeeded,
      destinationInputRef,
      exitMapDragMode,
      focusDestination,
      isExpanded,
      openDestination,
    ],
  );

  const handleDestinationChange = useCallback(
    (value: string) => {
      if (isMapDragMode) {
        exitMapDragMode();
      }

      changeDestination(value);
    },
    [changeDestination, exitMapDragMode, isMapDragMode],
  );

  const handleDestinationFocus = useCallback(() => {
    clearInteractionTimers();

    if (isMapDragMode) {
      exitMapDragMode();
      changeDestination("");
    }

    startDestinationSession();
    openDestination();
  }, [
    changeDestination,
    clearInteractionTimers,
    exitMapDragMode,
    isMapDragMode,
    openDestination,
    startDestinationSession,
  ]);

  const handleDestinationEnterWithoutSuggestion = useCallback(() => {
    clearInteractionTimers();

    if (!isExpanded) {
      return;
    }

    openDatePicker();
    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;
      destinationInputRef.current?.blur();
    }, 0);
  }, [clearInteractionTimers, destinationInputRef, isExpanded, openDatePicker]);

  const handleDestinationBlur = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
    }

    blurTimerRef.current = setTimeout(() => {
      blurTimerRef.current = null;
      const activeElement = document.activeElement;
      const registeredRegions = [
        suggestionsRef.current,
        datePickerElementRef.current,
        datePickerRef.current,
        guestPickerRef.current,
      ];
      const movedIntoRegisteredRegion = registeredRegions.some((region) =>
        region?.contains(activeElement as Node),
      );

      if (
        movedIntoRegisteredRegion ||
        activePopoverRef.current !== "destination"
      ) {
        return;
      }

      closeActivePopover();
      collapseShell();
    }, 100);
  }, [
    closeActivePopover,
    collapseShell,
    datePickerElementRef,
    datePickerRef,
    guestPickerRef,
    suggestionsRef,
  ]);

  const handleDestinationEscape = useCallback(() => {
    closeActivePopover();
    destinationInputRef.current?.focus();
  }, [closeActivePopover, destinationInputRef]);

  return {
    handleDestinationClick,
    handleDestinationChange,
    handleDestinationFocus,
    handleDestinationEnterWithoutSuggestion,
    handleDestinationBlur,
    handleDestinationEscape,
  };
};
