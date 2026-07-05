import React, { useEffect, useRef } from "react";
import { DatePicker } from "../../../../components/DatePicker";
import {
  type SearchParams,
  useSearchBarState,
} from "../../hooks/useSearchBarState";
import { SearchBarPopover } from "./SearchBarPopover";
import { SearchDateFields } from "./SearchDateFields";
import { SearchDestinationField } from "./SearchDestinationField";
import { SearchGuestSelector } from "./SearchGuestSelector";
import styles from "./SearchBar.module.css";

export type { SearchParams } from "../../hooks/useSearchBarState";

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

  const {
    checkIn,
    checkOut,
    adultOccupancy,
    childOccupancy,
    infantOccupancy,
    petOccupancy,
    isExpanded,
    showGuestPicker,
    showDatePicker,
    isComposing,
    isOpeningDatePicker,
    isOpeningGuestPicker,
    showSuggestions,
    inputText,
    suggestions,
    isPlacesLoading,
    selectedPlace,
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
    getTotalGuests,
  } = useSearchBarState({
    onSearch,
    onExpandedChange,
    isMapDragMode,
  });

  const closeDatePopover = () => {
    completeCheckoutIfNeeded();
    setShowDatePicker(false);
  };

  const handleSearchBarClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;

    // DatePicker의 실제 DOM 요소 확인
    const isDatePickerElement =
      datePickerElementRef.current?.contains(target);

    // 달력 영역 확인 (datePickerRef는 날짜 필드 영역)
    const isDatePickerArea = datePickerRef.current?.contains(target);

    // 여행자 필터 영역 확인
    const isGuestPickerArea = guestPickerRef.current?.contains(target);

    // 여행지 영역 확인
    const isDestinationArea = destinationAreaRef.current?.contains(target);

    // 추천 리스트 영역 확인
    const isSuggestionsArea = suggestionsRef.current?.contains(target);

    // 검색 버튼 확인
    const isSearchButton = target.closest(`.${styles.searchButton}`);

    // 달력이나 여행자 필터, 여행지 영역, 추천 리스트 영역을 클릭한 경우 아무것도 하지 않음
    // (각각의 핸들러가 처리함)
    if (
      isDatePickerArea ||
      isGuestPickerArea ||
      isDatePickerElement ||
      isDestinationArea ||
      isSuggestionsArea ||
      isSearchButton
    ) {
      // 확장되지 않은 상태에서 이 영역들을 클릭하면 확장만 함
      if (!isExpanded) {
        setExpanded(true);
      }
      return;
    }

    // 달력이나 여행자 필터, 여행지 영역, 추천 리스트 영역이 아닌 다른 부분을 클릭한 경우
    // 달력이나 여행자 필터, 추천 리스트가 열려있으면 닫기
    if (showDatePicker || showGuestPicker || showSuggestions) {
      // 체크인만 선택된 경우 체크아웃을 다음 날로 자동 설정
      closeTransientPanels({ collapseWhenDateSelected: true });
      event.stopPropagation();
      return;
    }

    // 달력이나 여행자 필터, 추천 리스트가 열려있지 않으면 검색바 축소 (목적지 입력 여부와 관계없이)
    setExpanded(false);
    event.stopPropagation();
  };

  const handleDestinationClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    // 다른 필터가 열려있으면 닫기 (검색바는 확장 상태 유지)
    if (showDatePicker || showGuestPicker) {
      // 체크인만 선택된 경우 체크아웃을 다음 날로 자동 설정
      if (showDatePicker) {
        completeCheckoutIfNeeded();
      }
      setShowDatePicker(false);
      setShowGuestPicker(false);
      // 필터 간 전환 시에는 검색바를 축소하지 않음 (확장 상태 유지)
    }

    // 지도 드래그 모드 해제
    exitMapDragMode();

    if (!isExpanded) {
      setExpanded(true);
      // 새 세션 시작
      startNewSession();
      // 확장 후 입력 필드에 포커스
      setTimeout(() => {
        destinationInputRef.current?.focus();
        // 입력값이 있으면 추천 리스트 표시
        if (inputText.trim()) {
          setShowSuggestions(true);
        }
      }, 0);
    } else {
      destinationInputRef.current?.focus();
      // 입력값이 있으면 추천 리스트 표시
      if (inputText.trim()) {
        setShowSuggestions(true);
      }
    }
  };

  const handleDestinationChange = (value: string) => {
    // 입력 시작 시 지도 드래그 모드 해제
    if (isMapDragMode) {
      exitMapDragMode();
    }

    handleInputChange(value);
  };

  const handleDestinationFocus = () => {
    // 포커스 시 지도 드래그 모드 해제
    if (isMapDragMode) {
      exitMapDragMode();
      // 지도 드래그 모드 해제 후 input 텍스트 초기화
      handleInputChange("");
    }

    // 여행지 입력 필드 포커스 시 달력 및 여행자 선택 닫기 (Bug fix: z-index 겹침 문제)
    setShowDatePicker(false);
    setShowGuestPicker(false);
    setShowSuggestions(true);
  };

  const handleDestinationEnterWithoutSuggestion = () => {
    if (!isExpanded) {
      return;
    }

    // 달력을 열기 전에 플래그 설정 (onBlur가 검색바를 축소하지 않도록)
    setIsOpeningDatePicker(true);
    setShowDatePicker(true);
    setShowGuestPicker(false);
    setShowSuggestions(false);

    // 약간의 지연을 두어 상태 업데이트가 완료된 후 포커스 제거 및 플래그 해제
    setTimeout(() => {
      destinationInputRef.current?.blur();
      setIsOpeningDatePicker(false);
    }, 100);
  };

  const handleDestinationBlur = () => {
    // 추천 리스트를 클릭한 경우를 제외하기 위해 약간의 지연
    // onMouseDown이 먼저 실행되므로 플래그가 설정되었을 수 있음
    setTimeout(() => {
      // 클릭한 요소가 추천 리스트 내부인지 확인
      const activeElement = document.activeElement;
      if (suggestionsRef.current?.contains(activeElement as Node)) {
        return;
      }

      // 클릭한 요소가 달력이나 여행자 필터 내부인지 확인
      const isClickingDatePicker = datePickerElementRef.current?.contains(
        activeElement as Node
      );
      const isClickingGuestPicker = guestPickerRef.current?.contains(
        activeElement as Node
      );
      const isClickingDateArea = datePickerRef.current?.contains(
        activeElement as Node
      );
      const isClickingGuestArea = guestPickerRef.current?.contains(
        activeElement as Node
      );

      setShowSuggestions(false);

      // 달력이나 여행자 필터가 열리는 중이거나 이미 열려있으면 검색바를 축소하지 않음
      // onMouseDown에서 플래그가 설정되었을 수 있으므로 확인
      if (
        !isOpeningDatePicker &&
        !isOpeningGuestPicker &&
        !showDatePicker &&
        !showGuestPicker &&
        !isClickingDatePicker &&
        !isClickingGuestPicker &&
        !isClickingDateArea &&
        !isClickingGuestArea
      ) {
        // 목적지 입력 필드에서 포커스를 잃을 때 검색바 축소 (목적지 입력 여부와 관계없이)
        setExpanded(false);
      }
    }, 100);
  };

  const handleDateClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    openDatePicker();
  };

  const handleGuestClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    toggleGuestPicker();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // DatePicker의 실제 DOM 요소 확인 (달력 컴포넌트 자체)
      const isInsideDatePicker =
        datePickerElementRef.current?.contains(target);

      // 달력 영역 확인 (datePickerRef는 날짜 필드 영역)
      const isInsideDateArea = datePickerRef.current?.contains(target);

      // GuestPicker의 실제 DOM 요소 확인 (여행자 필터 컴포넌트 자체)
      const isInsideGuestPicker = guestPickerRef.current?.contains(target);

      // 여행지 영역 확인
      const isInsideDestinationArea =
        destinationAreaRef.current?.contains(target);

      // Suggestions 영역 확인
      const isInsideSuggestions = suggestionsRef.current?.contains(target);

      // 검색바 내부 확인
      const isInsideSearchBar = searchBarRef.current?.contains(target);

      // 달력이나 여행자 필터, 여행지 영역, 추천 리스트 영역 내부가 아닌 경우
      if (
        !isInsideDatePicker &&
        !isInsideDateArea &&
        !isInsideGuestPicker &&
        !isInsideSuggestions &&
        !isInsideDestinationArea
      ) {
        // 검색바 외부를 클릭한 경우
        if (!isInsideSearchBar) {
          // 검색바 외부 클릭 시 항상 닫기
          if (showDatePicker || showGuestPicker || showSuggestions) {
            closeTransientPanels({ collapseWhenDateSelected: true });
          }

          // 검색바 외부 클릭 시 항상 축소 (목적지 입력 여부와 관계없이)
          setExpanded(false);
        }
      }
    };

    // click 이벤트로 변경하여 mousedown보다 늦게 실행되도록 함
    // 이렇게 하면 달력이나 여행자 필터를 클릭할 때 먼저 열린 후에 외부 클릭 체크가 됨
    if (showDatePicker || showGuestPicker || showSuggestions) {
      // 약간의 지연을 두어 상태 업데이트가 완료된 후 이벤트 리스너 추가
      const timeoutId = setTimeout(() => {
        document.addEventListener("click", handleClickOutside, true);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("click", handleClickOutside, true);
      };
    }
  }, [
    showDatePicker,
    showGuestPicker,
    showSuggestions,
    checkIn,
    checkOut,
    closeTransientPanels,
    setExpanded,
  ]);

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
