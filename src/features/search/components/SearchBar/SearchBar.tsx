import React, { useCallback, useRef } from "react";
import { DatePicker } from "../../../../shared/ui/DatePicker";
import {
  type SearchBarRoutePort,
  useSearchBarState,
} from "../../hooks/useSearchBarState";
import type { SearchParams } from "../../lib/searchBarContracts";
import type { SearchActivePopover } from "../../model/searchInteractionReducer";
import { SearchBarPopover } from "./SearchBarPopover";
import { SearchDateFields } from "./SearchDateFields";
import { SearchDestinationField } from "./SearchDestinationField";
import { SearchGuestSelector } from "./SearchGuestSelector";
import { useSearchBarDestinationInteractions } from "./useSearchBarDestinationInteractions";
import { useSearchBarOutsideClick } from "./useSearchBarOutsideClick";
import { useSearchBarShellInteractions } from "./useSearchBarShellInteractions";
import styles from "./SearchBar.module.css";

export type { SearchParams } from "../../lib/searchBarContracts";

interface SearchBarProps {
  routePort: SearchBarRoutePort;
  onSearch?: (searchParams: SearchParams) => void;
  isMapDragMode?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  routePort,
  onSearch,
  isMapDragMode = false,
}) => {
  const searchBarRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const destinationAreaRef = useRef<HTMLDivElement>(null);
  const datePickerElementRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const guestTriggerRef = useRef<HTMLButtonElement>(null);

  const { destination, dates, guests, popover, actions, status } =
    useSearchBarState({
      routePort,
      onSearch,
      isMapDragMode,
    });

  const { inputText, suggestions, selectedPlace } = destination;
  const { checkIn, checkOut } = dates;
  const {
    adultOccupancy,
    childOccupancy,
    infantOccupancy,
    petOccupancy,
    totalGuests,
  } = guests;
  const {
    activePopover,
    isExpanded,
    showGuestPicker,
    showDatePicker,
    isComposing,
    showSuggestions,
  } = popover;
  const { isPlacesLoading } = status;
  const {
    changeAdultOccupancy,
    changeChildOccupancy,
    changeInfantOccupancy,
    changePetOccupancy,
    expandShell,
    collapseShell,
    openDestination,
    openDatePicker,
    toggleGuestPicker,
    closeActivePopover,
    startComposition,
    endComposition,
    changeDestination,
    selectDestination,
    clearDestinationSelection,
    startDestinationSession,
    handleSearch,
    exitMapDragMode,
    completeCheckoutIfNeeded,
    closeTransientPanels,
    handleDateSelect,
  } = actions;

  const {
    handleDestinationClick,
    handleDestinationChange,
    handleDestinationFocus,
    handleDestinationEnterWithoutSuggestion,
    handleDestinationBlur,
    handleDestinationEscape,
  } = useSearchBarDestinationInteractions({
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
  });

  const {
    closeDatePopover,
    handleDateClick,
    handleGuestClick,
    handleSearchBarClick,
  } = useSearchBarShellInteractions({
    datePickerRef,
    guestPickerRef,
    datePickerElementRef,
    destinationAreaRef,
    suggestionsRef,
    searchButtonClassName: styles.searchButton,
    isExpanded,
    activePopover,
    completeCheckoutIfNeeded,
    closeTransientPanels,
    expandShell,
    collapseShell,
    closeActivePopover,
    openDatePicker,
    toggleGuestPicker,
  });

  useSearchBarOutsideClick({
    searchBarRef,
    datePickerRef,
    guestPickerRef,
    datePickerElementRef,
    destinationAreaRef,
    suggestionsRef,
    activePopover,
    closeTransientPanels,
    collapseShell,
  });

  const restorePopoverFocus = useCallback(
    (popoverToRestore: SearchActivePopover) => {
      if (popoverToRestore === "destination") {
        destinationInputRef.current?.focus();
      } else if (popoverToRestore === "date") {
        dateTriggerRef.current?.focus();
      } else if (popoverToRestore === "guests") {
        guestTriggerRef.current?.focus();
      }
    },
    [],
  );

  const closeDateAndRestoreFocus = useCallback(() => {
    closeDatePopover();
    dateTriggerRef.current?.focus();
  }, [closeDatePopover]);

  const closeGuestAndRestoreFocus = useCallback(() => {
    closeActivePopover();
    guestTriggerRef.current?.focus();
  }, [closeActivePopover]);

  const handleRootEscape = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape" || activePopover === "none") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const popoverToRestore = activePopover;

      if (activePopover === "date") {
        completeCheckoutIfNeeded();
      }
      closeActivePopover();
      restorePopoverFocus(popoverToRestore);
    },
    [
      activePopover,
      closeActivePopover,
      completeCheckoutIfNeeded,
      restorePopoverFocus,
    ],
  );

  return (
    <div
      ref={searchBarRef}
      aria-label="숙소 검색"
      className={`${styles.searchBar} ${isExpanded ? styles.expanded : ""}`}
      data-search-shell={isExpanded ? "expanded" : "compact"}
      onClick={handleSearchBarClick}
      onKeyDown={handleRootEscape}
      role="search"
    >
      <div
        ref={destinationAreaRef}
        className={styles.searchItem}
        onClick={handleDestinationClick}
      >
        {isExpanded ? (
          <SearchDestinationField
            inputRef={destinationInputRef}
            isActive={showSuggestions}
            isComposing={isComposing}
            isLoading={isPlacesLoading}
            onBlur={handleDestinationBlur}
            onChange={handleDestinationChange}
            onClear={clearDestinationSelection}
            onCompositionEnd={endComposition}
            onCompositionStart={startComposition}
            onEnterWithoutSuggestion={handleDestinationEnterWithoutSuggestion}
            onEscape={handleDestinationEscape}
            onFocus={handleDestinationFocus}
            onInputClick={(event) => event.stopPropagation()}
            onRequestSuggestions={openDestination}
            onSelect={(suggestion) => {
              if (typeof suggestion === "string") {
                changeDestination(suggestion);
                closeActivePopover();
                return;
              }

              selectDestination(suggestion);
            }}
            shouldClearOnValueChange={!!selectedPlace}
            suggestions={suggestions}
            suggestionsRef={suggestionsRef}
            value={inputText}
          />
        ) : (
          <div className={styles.compactValue}>
            {isMapDragMode
              ? "지도에 표시된 지역의 숙소"
              : inputText || "어디든지"}
          </div>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.searchItemHost} ref={datePickerRef}>
        <SearchDateFields
          checkIn={checkIn}
          checkOut={checkOut}
          isExpanded={isExpanded}
          isOpen={showDatePicker}
          onTriggerClick={handleDateClick}
          triggerRef={dateTriggerRef}
        />
        {isExpanded && showDatePicker && (
          <SearchBarPopover
            id="search-date-picker"
            variant="date"
            onClose={closeDateAndRestoreFocus}
          >
            <DatePicker
              checkIn={checkIn}
              checkOut={checkOut}
              onDateSelect={handleDateSelect}
              onClose={() => {
                completeCheckoutIfNeeded();
                closeActivePopover();
                collapseShell();
                dateTriggerRef.current?.focus();
              }}
              datePickerRef={datePickerElementRef}
            />
          </SearchBarPopover>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.searchItemHost} ref={guestPickerRef}>
        <button
          ref={guestTriggerRef}
          aria-controls="search-guest-picker"
          aria-expanded={showGuestPicker}
          className={styles.searchItem}
          onClick={handleGuestClick}
          type="button"
        >
          {isExpanded ? (
            <>
              <div className={styles.label}>여행자</div>
              <div className={styles.value}>
                {totalGuests > 0
                  ? `게스트 ${totalGuests}명`
                  : "게스트 추가"}
              </div>
            </>
          ) : (
            <div className={styles.compactValue}>
              {totalGuests > 0
                ? `게스트 ${totalGuests}명`
                : "게스트 추가"}
            </div>
          )}
        </button>
        {isExpanded && showGuestPicker && (
          <SearchBarPopover
            id="search-guest-picker"
            variant="guest"
            onClose={closeGuestAndRestoreFocus}
          >
            <SearchGuestSelector
              adultOccupancy={adultOccupancy}
              childOccupancy={childOccupancy}
              infantOccupancy={infantOccupancy}
              petOccupancy={petOccupancy}
              onAdultChange={changeAdultOccupancy}
              onChildChange={changeChildOccupancy}
              onInfantChange={changeInfantOccupancy}
              onPetChange={changePetOccupancy}
            />
          </SearchBarPopover>
        )}
      </div>

      <button
        aria-label="검색"
        className={styles.searchButton}
        onClick={(event) => {
          event.stopPropagation();

          if (activePopover === "date" || activePopover === "guests") {
            closeTransientPanels({ collapseWhenDateSelected: true });
          }

          handleSearch(event);
        }}
        type="button"
      >
        <svg viewBox="0 0 32 32" fill="currentColor">
          <path d="M13 0c7.18 0 13 5.82 13 13 0 2.868-.93 5.52-2.502 7.68l7.607 7.608-1.414 1.414-7.607-7.607C18.52 25.07 15.868 26 13 26 5.82 26 0 20.18 0 13S5.82 0 13 0zm0 2C7.477 2 3 6.477 3 12s4.477 10 10 10 10-4.477 10-10S18.523 2 13 2z" />
        </svg>
      </button>
    </div>
  );
};
