import { useCallback } from "react";
import type { MouseEvent } from "react";

interface SearchBarDomRef<T extends HTMLElement = HTMLElement> {
  readonly current: T | null;
}

interface UseSearchBarShellInteractionsOptions {
  searchBarRef: SearchBarDomRef<HTMLDivElement>;
  datePickerRef: SearchBarDomRef<HTMLDivElement>;
  guestPickerRef: SearchBarDomRef<HTMLDivElement>;
  datePickerElementRef: SearchBarDomRef<HTMLDivElement>;
  destinationAreaRef: SearchBarDomRef<HTMLDivElement>;
  suggestionsRef: SearchBarDomRef<HTMLDivElement>;
  searchButtonClassName: string;
  isExpanded: boolean;
  showDatePicker: boolean;
  showGuestPicker: boolean;
  showSuggestions: boolean;
  completeCheckoutIfNeeded: () => void;
  closeTransientPanels: (options?: {
    collapseWhenDateSelected?: boolean;
  }) => void;
  setExpanded: (isExpanded: boolean) => void;
  setShowDatePicker: (isOpen: boolean) => void;
  openDatePicker: () => void;
  toggleGuestPicker: () => void;
}

export interface SearchBarShellInteractions {
  closeDatePopover: () => void;
  handleDateClick: (event: MouseEvent<HTMLButtonElement>) => void;
  handleGuestClick: (event: MouseEvent) => void;
  handleSearchBarClick: (event: MouseEvent) => void;
}

export const useSearchBarShellInteractions = ({
  searchBarRef,
  datePickerRef,
  guestPickerRef,
  datePickerElementRef,
  destinationAreaRef,
  suggestionsRef,
  searchButtonClassName,
  isExpanded,
  showDatePicker,
  showGuestPicker,
  showSuggestions,
  completeCheckoutIfNeeded,
  closeTransientPanels,
  setExpanded,
  setShowDatePicker,
  openDatePicker,
  toggleGuestPicker,
}: UseSearchBarShellInteractionsOptions): SearchBarShellInteractions => {
  const closeDatePopover = useCallback(() => {
    completeCheckoutIfNeeded();
    setShowDatePicker(false);
  }, [completeCheckoutIfNeeded, setShowDatePicker]);

  const handleSearchBarClick = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isDatePickerElement = datePickerElementRef.current?.contains(target);
      const isDatePickerArea = datePickerRef.current?.contains(target);
      const isGuestPickerArea = guestPickerRef.current?.contains(target);
      const isDestinationArea = destinationAreaRef.current?.contains(target);
      const isSuggestionsArea = suggestionsRef.current?.contains(target);
      const isSearchButton = target.closest(`.${searchButtonClassName}`);

      if (
        isDatePickerArea ||
        isGuestPickerArea ||
        isDatePickerElement ||
        isDestinationArea ||
        isSuggestionsArea ||
        isSearchButton
      ) {
        if (!isExpanded) {
          setExpanded(true);
        }
        return;
      }

      if (showDatePicker || showGuestPicker || showSuggestions) {
        closeTransientPanels({ collapseWhenDateSelected: true });
        event.stopPropagation();
        return;
      }

      setExpanded(false);
      event.stopPropagation();
    },
    [
      closeTransientPanels,
      datePickerElementRef,
      datePickerRef,
      destinationAreaRef,
      guestPickerRef,
      isExpanded,
      searchButtonClassName,
      setExpanded,
      showDatePicker,
      showGuestPicker,
      showSuggestions,
      suggestionsRef,
    ],
  );

  const handleDateClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      openDatePicker();
    },
    [openDatePicker],
  );

  const handleGuestClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      toggleGuestPicker();
    },
    [toggleGuestPicker],
  );

  return {
    closeDatePopover,
    handleDateClick,
    handleGuestClick,
    handleSearchBarClick,
  };
};
