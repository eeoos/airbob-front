import { useEffect } from "react";
import type { SearchActivePopover } from "../../model/searchInteractionReducer";

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
  activePopover: SearchActivePopover;
  closeTransientPanels: (options?: {
    collapseWhenDateSelected?: boolean;
  }) => void;
  collapseShell: () => void;
}

export const useSearchBarOutsideClick = ({
  searchBarRef,
  datePickerRef,
  guestPickerRef,
  datePickerElementRef,
  destinationAreaRef,
  suggestionsRef,
  activePopover,
  closeTransientPanels,
  collapseShell,
}: UseSearchBarOutsideClickOptions): void => {
  useEffect(() => {
    if (activePopover === "none") {
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
          closeTransientPanels({ collapseWhenDateSelected: true });
          collapseShell();
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
    activePopover,
    collapseShell,
    suggestionsRef,
  ]);
};
