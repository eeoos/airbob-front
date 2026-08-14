import { useEffect } from "react";

interface SearchBarDomRef {
  readonly current: HTMLElement | null;
}

interface UseSearchBarOutsideClickOptions {
  searchBarRef: SearchBarDomRef;
  datePickerRef: SearchBarDomRef;
  guestPickerRef: SearchBarDomRef;
  datePickerElementRef: SearchBarDomRef;
  destinationAreaRef: SearchBarDomRef;
  suggestionsRef: SearchBarDomRef;
  showDatePicker: boolean;
  showGuestPicker: boolean;
  showSuggestions: boolean;
  closeTransientPanels: (options?: {
    collapseWhenDateSelected?: boolean;
  }) => void;
  setExpanded: (isExpanded: boolean) => void;
}

export const useSearchBarOutsideClick = ({
  searchBarRef,
  datePickerRef,
  guestPickerRef,
  datePickerElementRef,
  destinationAreaRef,
  suggestionsRef,
  showDatePicker,
  showGuestPicker,
  showSuggestions,
  closeTransientPanels,
  setExpanded,
}: UseSearchBarOutsideClickOptions): void => {
  useEffect(() => {
    if (!showDatePicker && !showGuestPicker && !showSuggestions) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      const isInsideDatePicker = datePickerElementRef.current?.contains(target);
      const isInsideDateArea = datePickerRef.current?.contains(target);
      const isInsideGuestPicker = guestPickerRef.current?.contains(target);
      const isInsideDestinationArea =
        destinationAreaRef.current?.contains(target);
      const isInsideSuggestions = suggestionsRef.current?.contains(target);
      const isInsideSearchBar = searchBarRef.current?.contains(target);

      if (
        !isInsideDatePicker &&
        !isInsideDateArea &&
        !isInsideGuestPicker &&
        !isInsideSuggestions &&
        !isInsideDestinationArea
      ) {
        if (!isInsideSearchBar) {
          if (showDatePicker || showGuestPicker || showSuggestions) {
            closeTransientPanels({ collapseWhenDateSelected: true });
          }

          setExpanded(false);
        }
      }
    };

    document.addEventListener("click", handleClickOutside, true);

    return () => {
      document.removeEventListener("click", handleClickOutside, true);
    };
  }, [
    closeTransientPanels,
    datePickerElementRef,
    datePickerRef,
    destinationAreaRef,
    guestPickerRef,
    searchBarRef,
    setExpanded,
    showDatePicker,
    showGuestPicker,
    showSuggestions,
    suggestionsRef,
  ]);
};
