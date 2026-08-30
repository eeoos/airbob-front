import { useCallback } from "react";
import type { MouseEvent } from "react";
import type { SearchActivePopover } from "../../model/searchInteractionReducer";

interface SearchBarDomRef<T extends HTMLElement = HTMLElement> {
  readonly current: T | null;
}

interface UseSearchBarShellInteractionsOptions {
  datePickerRef: SearchBarDomRef<HTMLDivElement>;
  guestPickerRef: SearchBarDomRef<HTMLDivElement>;
  datePickerElementRef: SearchBarDomRef<HTMLDivElement>;
  destinationAreaRef: SearchBarDomRef<HTMLDivElement>;
  suggestionsRef: SearchBarDomRef<HTMLDivElement>;
  searchButtonClassName: string;
  isExpanded: boolean;
  activePopover: SearchActivePopover;
  completeCheckoutIfNeeded: () => void;
  closeTransientPanels: (options?: {
    collapseWhenDateSelected?: boolean;
  }) => void;
  expandShell: () => void;
  collapseShell: () => void;
  closeActivePopover: () => void;
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
  datePickerRef,
  guestPickerRef,
  datePickerElementRef,
  destinationAreaRef,
  suggestionsRef,
  searchButtonClassName,
  isExpanded,
  activePopover,
  completeCheckoutIfNeeded,
  closeTransientPanels,
  expandShell,
  collapseShell,
  closeActivePopover,
  openDatePicker,
  toggleGuestPicker,
}: UseSearchBarShellInteractionsOptions): SearchBarShellInteractions => {
  const closeDatePopover = useCallback(() => {
    completeCheckoutIfNeeded();
    closeActivePopover();
  }, [closeActivePopover, completeCheckoutIfNeeded]);

  const handleSearchBarClick = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const registeredRegions = [
        datePickerElementRef.current,
        datePickerRef.current,
        guestPickerRef.current,
        destinationAreaRef.current,
        suggestionsRef.current,
      ];
      const isRegisteredRegion = registeredRegions.some((region) =>
        region?.contains(target),
      );
      const isSearchButton = target.closest(`.${searchButtonClassName}`);

      if (isRegisteredRegion || isSearchButton) {
        if (!isExpanded) {
          expandShell();
        }
        return;
      }

      if (activePopover !== "none") {
        closeTransientPanels({ collapseWhenDateSelected: true });
        event.stopPropagation();
        return;
      }

      collapseShell();
      event.stopPropagation();
    },
    [
      activePopover,
      closeTransientPanels,
      collapseShell,
      datePickerElementRef,
      datePickerRef,
      destinationAreaRef,
      expandShell,
      guestPickerRef,
      isExpanded,
      searchButtonClassName,
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
