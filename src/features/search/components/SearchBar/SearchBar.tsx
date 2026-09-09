import React, { useCallback, useRef } from "react";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import { useResponsiveLayout } from "../../../../shared/styles/useResponsiveLayout";
import { DatePicker } from "../../../../shared/ui/DatePicker";
import {
  type SearchBarRoutePort,
  useSearchBarState,
} from "../../hooks/useSearchBarState";
import type { SearchParams } from "../../lib/searchBarContracts";
import { SearchBarPopover } from "./SearchBarPopover";
import { SearchDateFields } from "./SearchDateFields";
import { SearchDestinationField } from "./SearchDestinationField";
import { SearchGuestSelector } from "./SearchGuestSelector";
import { useSearchBarDestinationInteractions } from "./useSearchBarDestinationInteractions";
import { useSearchBarOutsideClick } from "./useSearchBarOutsideClick";
import { useSearchBarShellInteractions } from "./useSearchBarShellInteractions";
import styles from "./SearchBar.module.css";

const LazyMobileSearchBar = React.lazy(() => import("./MobileSearchBar"));

interface SearchBarBaseProps {
  routePort: SearchBarRoutePort;
  onSearch?: (searchParams: SearchParams) => void;
  isMapDragMode?: boolean;
}

type SearchBarProps = SearchBarBaseProps &
  (
    | { mobileHeader: boolean; onMobileBack: () => void }
    | { mobileHeader?: false; onMobileBack?: never }
  );

export const SearchBar: React.FC<SearchBarProps> = (props) => {
  const isMobileOrTablet = useResponsiveLayout() === "mobile-tablet";

  if (isMobileOrTablet) {
    return (
      <React.Suspense
        fallback={
          <div
            aria-busy="true"
            aria-label="숙소 검색"
            className={
              props.mobileHeader ? styles.mobileHeaderBar : styles.mobileHomeBar
            }
            role="search"
          >
            <span className={styles.visuallyHidden}>
              검색 화면을 준비하는 중입니다.
            </span>
          </div>
        }
      >
        <LazyMobileSearchBar
          routePort={props.routePort}
          isMapDragMode={props.isMapDragMode ?? false}
          {...(props.mobileHeader
            ? { mobileHeader: true, onMobileBack: props.onMobileBack }
            : { mobileHeader: false })}
          {...(props.onSearch === undefined
            ? {}
            : { onSearch: props.onSearch })}
        />
      </React.Suspense>
    );
  }

  return (
    <DesktopSearchBar
      routePort={props.routePort}
      isMapDragMode={props.isMapDragMode ?? false}
      {...(props.onSearch === undefined ? {} : { onSearch: props.onSearch })}
    />
  );
};

const DesktopSearchBar: React.FC<SearchBarBaseProps> = ({
  routePort,
  onSearch,
  isMapDragMode = false,
}) => {
  const searchBarRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const destinationAreaRef = useRef<HTMLElement>(null);
  const datePickerElementRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const guestTriggerRef = useRef<HTMLButtonElement>(null);
  const setDestinationAreaRef = useCallback((element: HTMLElement | null) => {
    destinationAreaRef.current = element;
  }, []);

  const { destination, dates, guests, popover, actions, status } =
    useSearchBarState({
      routePort,
      ...(onSearch === undefined ? {} : { onSearch }),
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
    activePopover,
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
    searchButtonClassName: requireCssModuleClass(styles.searchButton),
    activePopover,
    completeCheckoutIfNeeded,
    closeTransientPanels,
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

  const closeDateAndRestoreFocus = useCallback(() => {
    closeDatePopover();
    dateTriggerRef.current?.focus();
  }, [closeDatePopover]);

  const closeGuestAndRestoreFocus = useCallback(() => {
    closeActivePopover();
    guestTriggerRef.current?.focus();
  }, [closeActivePopover]);

  const advanceToDate = useCallback(() => {
    handleDestinationEnterWithoutSuggestion();
    dateTriggerRef.current?.focus();
  }, [handleDestinationEnterWithoutSuggestion]);

  const submitSearch = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (isPlacesLoading) return;

      if (activePopover === "date" || activePopover === "guests") {
        closeTransientPanels({ collapseWhenDateSelected: true });
      }

      handleSearch(event);
    },
    [activePopover, closeTransientPanels, handleSearch, isPlacesLoading],
  );

  return (
    <div
      ref={searchBarRef}
      aria-label="숙소 검색"
      className={`${styles.searchBar} ${isExpanded ? styles.expanded : ""}`}
      data-expanded={isExpanded ? "" : undefined}
      onClickCapture={handleSearchBarClick}
      role="search"
    >
      {isExpanded ? (
        <div
          ref={setDestinationAreaRef}
          className={`${styles.searchItem} ${styles.destinationItem}`}
          data-active={showSuggestions ? "" : undefined}
        >
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
            onEnterWithoutSuggestion={advanceToDate}
            onEscape={handleDestinationEscape}
            onFocus={handleDestinationFocus}
            onInputClick={(event) => event.stopPropagation()}
            onRequestSuggestions={openDestination}
            onSelect={(suggestion) => {
              if (typeof suggestion === "string") {
                changeDestination(suggestion);
              } else {
                selectDestination(suggestion);
              }

              advanceToDate();
            }}
            shouldClearOnValueChange={!!selectedPlace}
            suggestions={suggestions}
            suggestionsRef={suggestionsRef}
            value={inputText}
          />
        </div>
      ) : (
        <button
          ref={setDestinationAreaRef}
          className={`${styles.searchItem} ${styles.destinationItem}`}
          onClick={handleDestinationClick}
          type="button"
        >
          <div className={styles.compactValue}>
            {inputText ||
              (isMapDragMode ? "지도에 표시된 지역의 숙소" : "어디든지")}
          </div>
        </button>
      )}

      <div className={styles.divider} />

      <div
        className={`${styles.searchItemHost} ${styles.dateItemHost}`}
        ref={datePickerRef}
      >
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
            triggerRef={dateTriggerRef}
            variant="date"
            onClose={closeDateAndRestoreFocus}
          >
            <DatePicker
              variant="search"
              checkIn={checkIn}
              checkOut={checkOut}
              onDateSelect={handleDateSelect}
              onEscape={closeDateAndRestoreFocus}
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

      <div
        className={`${styles.searchItemHost} ${styles.guestItemHost}`}
        ref={guestPickerRef}
      >
        <button
          ref={guestTriggerRef}
          aria-controls="search-guest-picker"
          aria-expanded={showGuestPicker}
          aria-haspopup="dialog"
          className={styles.searchItem}
          data-active={showGuestPicker ? "" : undefined}
          onClick={handleGuestClick}
          type="button"
        >
          {isExpanded ? (
            <>
              <div className={styles.label}>여행자</div>
              <div className={styles.value}>
                {totalGuests > 0 ? `게스트 ${totalGuests}명` : "게스트 추가"}
              </div>
            </>
          ) : (
            <div className={styles.compactValue}>
              {totalGuests > 0 ? `게스트 ${totalGuests}명` : "게스트 추가"}
            </div>
          )}
        </button>
        {isExpanded && showGuestPicker && (
          <SearchBarPopover
            id="search-guest-picker"
            triggerRef={guestTriggerRef}
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
        onClick={submitSearch}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 32 32" fill="currentColor">
          <path d="M13 0c7.18 0 13 5.82 13 13 0 2.868-.93 5.52-2.502 7.68l7.607 7.608-1.414 1.414-7.607-7.607C18.52 25.07 15.868 26 13 26 5.82 26 0 20.18 0 13S5.82 0 13 0zm0 2C7.477 2 3 6.477 3 12s4.477 10 10 10 10-4.477 10-10S18.523 2 13 2z" />
        </svg>
      </button>
    </div>
  );
};
