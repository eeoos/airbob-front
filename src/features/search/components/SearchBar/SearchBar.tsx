import React, { useRef } from "react";
import { DatePicker } from "../../../../components/DatePicker";
import type { SearchParams } from "../../lib/searchBarContracts";
import {
  useSearchBarState,
} from "../../hooks/useSearchBarState";
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
  onSearch?: (searchParams: SearchParams) => void;
  onExpandedChange?: (isExpanded: boolean) => void;
  isMapDragMode?: boolean; // 지도 드래그 모드 여부
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onExpandedChange,
  isMapDragMode = false,
}) => {
  const searchBarRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const destinationAreaRef = useRef<HTMLDivElement>(null);
  const datePickerElementRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { destination, dates, guests, popover, actions, status } =
    useSearchBarState({
      onSearch,
      onExpandedChange,
      isMapDragMode,
    });

  const {
    inputText,
    suggestions,
    selectedPlace,
  } = destination;
  const { checkIn, checkOut } = dates;
  const {
    adultOccupancy,
    childOccupancy,
    infantOccupancy,
    petOccupancy,
    getTotalGuests,
  } = guests;
  const {
    isExpanded,
    showGuestPicker,
    showDatePicker,
    isComposing,
    isOpeningDatePicker,
    isOpeningGuestPicker,
    showSuggestions,
  } = popover;
  const { isPlacesLoading } = status;
  const {
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
  } = actions;

  const {
    handleDestinationClick,
    handleDestinationChange,
    handleDestinationFocus,
    handleDestinationEnterWithoutSuggestion,
    handleDestinationBlur,
  } = useSearchBarDestinationInteractions({
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
  });

  const {
    closeDatePopover,
    handleDateClick,
    handleGuestClick,
    handleSearchBarClick,
  } = useSearchBarShellInteractions({
    searchBarRef,
    datePickerRef,
    guestPickerRef,
    datePickerElementRef,
    destinationAreaRef,
    suggestionsRef,
    searchButtonClassName: styles.searchButton,
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
  });

  useSearchBarOutsideClick({
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
  });

  return (
    <div
      ref={searchBarRef}
      className={`${styles.searchBar} ${isExpanded ? styles.expanded : ""}`}
      onClick={handleSearchBarClick}
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
            onClear={resetPlaces}
            onCompositionEnd={() => setIsComposing(false)}
            onCompositionStart={() => setIsComposing(true)}
            onEnterWithoutSuggestion={handleDestinationEnterWithoutSuggestion}
            onEscape={() => setShowSuggestions(false)}
            onFocus={handleDestinationFocus}
            onInputClick={(event) => event.stopPropagation()}
            onRequestSuggestions={() => setShowSuggestions(true)}
            onSelect={(suggestion) => {
              if (typeof suggestion === "string") {
                handleInputChange(suggestion);
                setShowSuggestions(false);
                return;
              }

              handlePlaceSelect(suggestion);
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
          onTriggerMouseDown={() => {
            // onBlur보다 먼저 실행되도록 onMouseDown에서 플래그 설정
            setIsOpeningDatePicker(true);
          }}
          onTriggerClick={handleDateClick}
        />
        {isExpanded && showDatePicker && (
          <SearchBarPopover
            id="search-date-picker"
            variant="date"
            onClose={closeDatePopover}
          >
            <DatePicker
              checkIn={checkIn}
              checkOut={checkOut}
              onDateSelect={handleDateSelect}
              onClose={() => {
                // 체크인만 선택된 경우 체크아웃을 다음 날로 자동 설정
                completeCheckoutIfNeeded();
                setShowDatePicker(false);
                // 닫기 버튼 클릭 시 검색바를 축소 모드로 변경
                setExpanded(false);
              }}
              datePickerRef={datePickerElementRef}
            />
          </SearchBarPopover>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.searchItemHost} ref={guestPickerRef}>
        <button
          aria-controls="search-guest-picker"
          aria-expanded={showGuestPicker}
          className={styles.searchItem}
          onMouseDown={() => {
            // onBlur보다 먼저 실행되도록 onMouseDown에서 플래그 설정
            setIsOpeningGuestPicker(true);
          }}
          onClick={handleGuestClick}
          type="button"
        >
          {isExpanded ? (
            <>
              <div className={styles.label}>여행자</div>
              <div className={styles.value}>
                {getTotalGuests() > 0
                  ? `게스트 ${getTotalGuests()}명`
                  : "게스트 추가"}
              </div>
            </>
          ) : (
            <div className={styles.compactValue}>
              {getTotalGuests() > 0
                ? `게스트 ${getTotalGuests()}명`
                : "게스트 추가"}
            </div>
          )}
        </button>
        {isExpanded && showGuestPicker && (
          <SearchBarPopover
            id="search-guest-picker"
            variant="guest"
            onClose={() => setShowGuestPicker(false)}
          >
            <SearchGuestSelector
              adultOccupancy={adultOccupancy}
              childOccupancy={childOccupancy}
              infantOccupancy={infantOccupancy}
              petOccupancy={petOccupancy}
              onAdultChange={setAdultOccupancy}
              onChildChange={setChildOccupancy}
              onInfantChange={setInfantOccupancy}
              onPetChange={setPetOccupancy}
            />
          </SearchBarPopover>
        )}
      </div>

      <button
        aria-label="검색"
        className={styles.searchButton}
        onClick={(event) => {
          event.stopPropagation();

          // 검색 버튼 클릭 시 열려있는 필터 닫기
          if (showDatePicker || showGuestPicker) {
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
