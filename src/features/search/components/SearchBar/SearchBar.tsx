import React, { useRef, useEffect } from "react";
import { DatePicker } from "../../../../components/DatePicker";
import {
  type SearchParams,
  useSearchBarState,
} from "../../hooks/useSearchBarState";
import styles from "./SearchBar.module.css";

export type { SearchParams } from "../../hooks/useSearchBarState";

interface SearchBarProps {
  onSearch?: (searchParams: SearchParams) => void;
  onExpandedChange?: (isExpanded: boolean) => void;
  isMapDragMode?: boolean; // 지도 드래그 모드 여부
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onExpandedChange, isMapDragMode = false }) => {
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

  const formatDisplayDate = (date: Date | null): string => {
    if (!date) return "";
    const month = date.toLocaleDateString("ko-KR", { month: "long" });
    const day = date.getDate();
    return `${month} ${day}일`;
  };

  const formatCompactDate = (date: Date | null): string => {
    if (!date) return "";
    const month = date.toLocaleDateString("ko-KR", { month: "short" });
    const day = date.getDate();
    return `${month} ${day}일`;
  };

  const handleSearchBarClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // DatePicker의 실제 DOM 요소 확인
    const isDatePickerElement = datePickerElementRef.current?.contains(target);
    
    // 달력 영역 확인 (datePickerRef는 날짜 필드 영역)
    const isDatePickerArea = datePickerRef.current?.contains(target);
    
    // 여행자 필터 영역 확인
    const isGuestPickerArea = guestPickerRef.current?.contains(target);
    
    // 여행지 영역 확인
    const isDestinationArea = destinationAreaRef.current?.contains(target);
    
    // 추천 리스트 영역 확인
    const isSuggestionsArea = suggestionsRef.current?.contains(target);
    
    // 검색 버튼 확인
    const isSearchButton = (target as HTMLElement).closest(`.${styles.searchButton}`);
    
    // 달력이나 여행자 필터, 여행지 영역, 추천 리스트 영역을 클릭한 경우 아무것도 하지 않음
    // (각각의 핸들러가 처리함)
    if (isDatePickerArea || isGuestPickerArea || isDatePickerElement || isDestinationArea || isSuggestionsArea || isSearchButton) {
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
      e.stopPropagation();
      return;
    }
    // 달력이나 여행자 필터, 추천 리스트가 열려있지 않으면 검색바 축소 (목적지 입력 여부와 관계없이)
    setExpanded(false);
    e.stopPropagation();
  };

  const handleDestinationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
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

  const handleDestinationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중일 때는 엔터 키 처리를 하지 않음
    if (e.key === "Enter" && !isComposing) {
      e.preventDefault();
      e.stopPropagation();
      // 추천 리스트가 열려있고 첫 번째 항목이 있으면 선택
      if (showSuggestions && suggestions.length > 0) {
        handlePlaceSelect(suggestions[0]);
        return;
      }
      // 확장된 상태에서 엔터를 누르면 체크인/체크아웃 달력 열기
      if (isExpanded) {
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
      }
    } else if (e.key === "Escape") {
      // ESC 키로 추천 리스트 닫기
      setShowSuggestions(false);
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const handleDateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openDatePicker();
  };

  const handleGuestClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleGuestPicker();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // DatePicker의 실제 DOM 요소 확인 (달력 컴포넌트 자체)
      const isInsideDatePicker = datePickerElementRef.current?.contains(target);
      
      // 달력 영역 확인 (datePickerRef는 날짜 필드 영역)
      const isInsideDateArea = datePickerRef.current?.contains(target);
      
      // GuestPicker의 실제 DOM 요소 확인 (여행자 필터 컴포넌트 자체)
      const isInsideGuestPicker = guestPickerRef.current?.contains(target);
      
      // 여행지 영역 확인
      const isInsideDestinationArea = destinationAreaRef.current?.contains(target);
      
      // Suggestions 영역 확인
      const isInsideSuggestions = suggestionsRef.current?.contains(target);
      
      // 검색바 내부 확인
      const isInsideSearchBar = searchBarRef.current?.contains(target);
      
      // 달력이나 여행자 필터, 여행지 영역, 추천 리스트 영역 내부가 아닌 경우
      if (!isInsideDatePicker && !isInsideDateArea && !isInsideGuestPicker && !isInsideSuggestions && !isInsideDestinationArea) {
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
          <>
            <div className={styles.label}>여행지</div>
            <div className={styles.inputWrapper}>
              <input
                ref={destinationInputRef}
                type="text"
                placeholder="어디로 여행가세요?"
                value={inputText}
                onChange={(e) => {
                  // 입력 시작 시 지도 드래그 모드 해제
                  if (isMapDragMode) {
                    exitMapDragMode();
                  }
                  const newValue = e.target.value;
                  // 검색어가 변경되었을 때 이전에 선택한 Google Place 초기화
                  // (새로운 검색어에 대한 Google Place를 선택할 수 있도록)
                  if (selectedPlace && newValue !== inputText) {
                    resetPlaces();
                  }
                  handleInputChange(newValue);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
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
                }}
                onKeyDown={handleDestinationKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onBlur={(e) => {
                  // 추천 리스트를 클릭한 경우를 제외하기 위해 약간의 지연
                  // onMouseDown이 먼저 실행되므로 플래그가 설정되었을 수 있음
                  setTimeout(() => {
                    // 클릭한 요소가 추천 리스트 내부인지 확인
                    const activeElement = document.activeElement;
                    if (suggestionsRef.current?.contains(activeElement as Node)) {
                      return;
                    }
                    // 클릭한 요소가 달력이나 여행자 필터 내부인지 확인
                    const isClickingDatePicker = datePickerElementRef.current?.contains(activeElement as Node);
                    const isClickingGuestPicker = guestPickerRef.current?.contains(activeElement as Node);
                    const isClickingDateArea = datePickerRef.current?.contains(activeElement as Node);
                    const isClickingGuestArea = guestPickerRef.current?.contains(activeElement as Node);
                    
                    setShowSuggestions(false);
                    // 달력이나 여행자 필터가 열리는 중이거나 이미 열려있으면 검색바를 축소하지 않음
                    // onMouseDown에서 플래그가 설정되었을 수 있으므로 확인
                    if (!isOpeningDatePicker && !isOpeningGuestPicker && !showDatePicker && !showGuestPicker && !isClickingDatePicker && !isClickingGuestPicker && !isClickingDateArea && !isClickingGuestArea) {
                      // 목적지 입력 필드에서 포커스를 잃을 때 검색바 축소 (목적지 입력 여부와 관계없이)
                      setExpanded(false);
                    }
                  }, 100);
                }}
                className={styles.input}
                onClick={(e) => e.stopPropagation()}
              />
              {showSuggestions && (suggestions.length > 0 || isPlacesLoading) && (
                <div ref={suggestionsRef} className={styles.suggestions}>
                  {isPlacesLoading && (
                    <div className={styles.suggestionItem}>검색 중...</div>
                  )}
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.placeId}
                      className={styles.suggestionItem}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePlaceSelect(suggestion);
                      }}
                      type="button"
                    >
                      <div className={styles.suggestionMainText}>
                        {suggestion.mainText}
                      </div>
                      {suggestion.secondaryText && (
                        <div className={styles.suggestionSecondaryText}>
                          {suggestion.secondaryText}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.compactValue}>
            {isMapDragMode ? "지도에 표시된 지역의 숙소" : (inputText || "어디든지")}
          </div>
        )}
      </div>

      <div className={styles.divider} />

      <div
        className={styles.searchItem}
        ref={datePickerRef}
        style={{ position: "relative" }}
        onMouseDown={(e) => {
          // onBlur보다 먼저 실행되도록 onMouseDown에서 플래그 설정
          setIsOpeningDatePicker(true);
        }}
        onClick={handleDateClick}
      >
        {isExpanded ? (
          <>
            <div className={styles.dateFields}>
              <div className={styles.dateField}>
                <div className={styles.label}>체크인</div>
                <div className={styles.value}>
                  {checkIn ? formatDisplayDate(checkIn) : "날짜 추가"}
                </div>
              </div>
              <div className={styles.dateField}>
                <div className={styles.label}>체크아웃</div>
                <div className={styles.value}>
                  {checkOut ? formatDisplayDate(checkOut) : "날짜 추가"}
                </div>
              </div>
            </div>
            {showDatePicker && (
              <div className={styles.datePickerContainer}>
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
              </div>
            )}
          </>
        ) : (
          <div className={styles.compactValue}>
            {checkIn && checkOut
              ? `${formatCompactDate(checkIn)} - ${formatCompactDate(checkOut)}`
              : "언제든지"}
          </div>
        )}
      </div>

      <div className={styles.divider} />

      <div
        className={styles.searchItem}
        ref={guestPickerRef}
        style={{ position: "relative" }}
        onMouseDown={(e) => {
          // onBlur보다 먼저 실행되도록 onMouseDown에서 플래그 설정
          setIsOpeningGuestPicker(true);
        }}
        onClick={handleGuestClick}
      >
        {isExpanded ? (
          <>
            <div className={styles.label}>여행자</div>
            <div className={styles.value}>
              {getTotalGuests() > 0
                ? `게스트 ${getTotalGuests()}명`
                : "게스트 추가"}
            </div>
            {showGuestPicker && (
              <div className={styles.guestPicker}>
                <div className={styles.guestRow}>
                  <div>
                    <div className={styles.guestLabel}>성인</div>
                    <div className={styles.guestSubLabel}>13세 이상</div>
                  </div>
                  <div className={styles.guestControls}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAdultOccupancy(Math.max(1, adultOccupancy - 1));
                      }}
                      disabled={adultOccupancy <= 1}
                      className={styles.controlButton}
                    >
                      −
                    </button>
                    <span className={styles.guestCount}>{adultOccupancy}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAdultOccupancy(adultOccupancy + 1);
                      }}
                      className={styles.controlButton}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={styles.guestRow}>
                  <div>
                    <div className={styles.guestLabel}>어린이</div>
                    <div className={styles.guestSubLabel}>2~12세</div>
                  </div>
                  <div className={styles.guestControls}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChildOccupancy(Math.max(0, childOccupancy - 1));
                      }}
                      disabled={childOccupancy <= 0}
                      className={styles.controlButton}
                    >
                      −
                    </button>
                    <span className={styles.guestCount}>{childOccupancy}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChildOccupancy(childOccupancy + 1);
                      }}
                      className={styles.controlButton}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={styles.guestRow}>
                  <div>
                    <div className={styles.guestLabel}>유아</div>
                    <div className={styles.guestSubLabel}>2세 미만</div>
                  </div>
                  <div className={styles.guestControls}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfantOccupancy(Math.max(0, infantOccupancy - 1));
                      }}
                      disabled={infantOccupancy <= 0}
                      className={styles.controlButton}
                    >
                      −
                    </button>
                    <span className={styles.guestCount}>{infantOccupancy}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfantOccupancy(infantOccupancy + 1);
                      }}
                      className={styles.controlButton}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className={styles.guestRow}>
                  <div>
                    <div className={styles.guestLabel}>반려동물</div>
                    <div className={styles.guestSubLabel}>반려동물을 데려오시나요?</div>
                  </div>
                  <div className={styles.guestControls}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPetOccupancy(Math.max(0, petOccupancy - 1));
                      }}
                      disabled={petOccupancy <= 0}
                      className={styles.controlButton}
                    >
                      −
                    </button>
                    <span className={styles.guestCount}>{petOccupancy}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPetOccupancy(petOccupancy + 1);
                      }}
                      className={styles.controlButton}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.compactValue}>
            {getTotalGuests() > 0 ? `게스트 ${getTotalGuests()}명` : "게스트 추가"}
          </div>
        )}
      </div>

      <button
        aria-label="검색"
        className={styles.searchButton}
        onClick={(e) => {
          e.stopPropagation();
          // 검색 버튼 클릭 시 열려있는 필터 닫기
          if (showDatePicker || showGuestPicker) {
            closeTransientPanels({ collapseWhenDateSelected: true });
          }
          handleSearch(e);
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
