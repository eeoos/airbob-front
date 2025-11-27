import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { DatePicker } from "../DatePicker";
import { usePlacesAutocomplete } from "../../hooks/usePlacesAutocomplete";
import styles from "./SearchBar.module.css";

interface SearchBarProps {
  onSearch?: (searchParams: SearchParams) => void;
  onExpandedChange?: (isExpanded: boolean) => void;
  isMapDragMode?: boolean; // 지도 드래그 모드 여부
  startExpanded?: boolean; // 확장된 상태로 시작할지 여부 (모바일용)
}

export interface SearchParams {
  destination?: string; // 표시용 (UI에만 사용)
  lat?: number;
  lng?: number;
  viewport?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  checkIn?: Date;
  checkOut?: Date;
  adultOccupancy?: number;
  childOccupancy?: number;
  infantOccupancy?: number;
  petOccupancy?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onExpandedChange, isMapDragMode = false, startExpanded = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [adultOccupancy, setAdultOccupancy] = useState(1);
  const [childOccupancy, setChildOccupancy] = useState(0);
  const [infantOccupancy, setInfantOccupancy] = useState(0);
  const [petOccupancy, setPetOccupancy] = useState(0);
  const [isExpanded, setIsExpanded] = useState(startExpanded);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isOpeningDatePicker, setIsOpeningDatePicker] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const datePickerElementRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Google Places Autocomplete 훅
  const {
    inputText,
    suggestions,
    isLoading: isPlacesLoading,
    selectedPlace,
    handleInputChange,
    handlePlaceSelect,
    clearSuggestions,
    reset: resetPlaces,
    startNewSession,
  } = usePlacesAutocomplete({
    debounceMs: 250,
    onPlaceSelect: (place) => {
      // 장소 선택 시 자동완성 리스트 닫기
      setShowSuggestions(false);
    },
  });

  const handleSearch = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    // 검색 시 달력과 여행자 선택 창, 추천 리스트 닫기
    setShowDatePicker(false);
    setShowGuestPicker(false);
    setShowSuggestions(false);

    // Google Place가 선택되었는지 확인
    // selectedPlace가 있으면 Google Place가 선택된 것으로 간주
    const isPlaceSelected = selectedPlace?.lat && selectedPlace?.lng && selectedPlace?.viewport;

    // Google Place 선택 시에만 좌표와 viewport 포함, 그렇지 않으면 undefined로 설정하여 제거
    const searchParams: SearchParams = {
      destination: inputText || undefined, // UI 표시용
      // selectedPlace가 있고 완전한 정보가 있을 때만 좌표와 viewport 설정
      // 검색어만 변경되고 Google Places를 선택하지 않은 경우 selectedPlace는 null이어야 함
      lat: isPlaceSelected ? selectedPlace.lat : undefined,
      lng: isPlaceSelected ? selectedPlace.lng : undefined,
      viewport: isPlaceSelected ? selectedPlace.viewport : undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      adultOccupancy,
      childOccupancy,
      infantOccupancy,
      petOccupancy,
    };

    if (onSearch) {
      onSearch(searchParams);
    } else {
      // 기본 동작: 검색 페이지로 이동
      // 기존 URL 파라미터를 가져와서 유지 (날짜, 인원 수 등)
      const params = new URLSearchParams(window.location.search);
      
      // destination 설정
      if (inputText) {
        params.set("destination", inputText);
      } else {
        params.delete("destination");
      }
      
      // 검색어가 변경되면 페이지를 1페이지(0페이지)로 리셋
      params.delete("page");
      
      // Google Place 선택 시에만 좌표와 viewport 설정
      // 검색어만 변경된 경우 (selectedPlace가 없는 경우) viewport/좌표 제거
      if (selectedPlace?.lat && selectedPlace?.lng && selectedPlace?.viewport) {
        // Google Place가 선택된 경우: 좌표와 viewport 설정
        params.set("lat", selectedPlace.lat.toString());
        params.set("lng", selectedPlace.lng.toString());
        params.set("topLeftLat", selectedPlace.viewport.north.toString());
        params.set("topLeftLng", selectedPlace.viewport.west.toString());
        params.set("bottomRightLat", selectedPlace.viewport.south.toString());
        params.set("bottomRightLng", selectedPlace.viewport.east.toString());
      } else {
        // Google Place가 선택되지 않고 검색어만 변경된 경우: 이전 viewport/좌표 파라미터 명시적으로 제거
        // (destination 기반 검색을 위해 - 이전 위치 정보가 남아있으면 잘못된 검색 결과가 나올 수 있음)
        params.delete("topLeftLat");
        params.delete("topLeftLng");
        params.delete("bottomRightLat");
        params.delete("bottomRightLng");
        params.delete("lat");
        params.delete("lng");
      }
      if (checkIn) params.set("checkIn", formatDate(checkIn));
      if (checkOut) params.set("checkOut", formatDate(checkOut));
      params.set("adultOccupancy", adultOccupancy.toString());
      params.set("childOccupancy", childOccupancy.toString());
      params.set("infantOccupancy", infantOccupancy.toString());
      params.set("petOccupancy", petOccupancy.toString());
      
      navigate(`/search?${params.toString()}`);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

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

  const getTotalGuests = () => {
    return adultOccupancy + childOccupancy;
  };

  const handleSearchBarClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // DatePicker의 실제 DOM 요소 확인
    const isDatePickerElement = datePickerElementRef.current?.contains(target);
    
    // 달력 영역 확인 (datePickerRef는 날짜 필드 영역)
    const isDatePickerArea = datePickerRef.current?.contains(target);
    
    // 여행자 필터 영역 확인
    const isGuestPickerArea = guestPickerRef.current?.contains(target);
    
    // 추천 리스트 영역 확인
    const isSuggestionsArea = suggestionsRef.current?.contains(target);
    
    // 검색 버튼 확인
    const isSearchButton = (target as HTMLElement).closest(`.${styles.searchButton}`);
    
    // 달력이나 여행자 필터, 추천 리스트 영역이 아닌 다른 부분을 클릭한 경우
    if (!isDatePickerArea && !isGuestPickerArea && !isDatePickerElement && !isSearchButton && !isSuggestionsArea) {
      // 달력이나 여행자 필터, 추천 리스트가 열려있으면 닫기
      if (showDatePicker || showGuestPicker || showSuggestions) {
        // 체크인만 선택된 경우 체크아웃을 다음 날로 자동 설정
        if (checkIn && !checkOut && showDatePicker) {
          const nextDay = new Date(checkIn);
          nextDay.setDate(nextDay.getDate() + 1);
          setCheckOut(nextDay);
        }
        setShowDatePicker(false);
        setShowGuestPicker(false);
        setShowSuggestions(false);
        // 날짜가 선택되었으면 검색바를 축소 모드로 변경
        if (checkIn || checkOut) {
          setIsExpanded(false);
          onExpandedChange?.(false);
        }
        e.stopPropagation();
        return;
      }
      // 달력이나 여행자 필터, 추천 리스트가 열려있지 않으면 검색바 축소 (목적지 입력 여부와 관계없이)
      setIsExpanded(false);
      onExpandedChange?.(false);
      e.stopPropagation();
      return;
    }
    
    if (!isExpanded) {
      setIsExpanded(true);
      onExpandedChange?.(true);
    }
  };

  // 지도 드래그 모드 해제 (목적지 입력 시작 시)
  const exitMapDragMode = () => {
    if (isMapDragMode && location.pathname === "/search") {
      // URL에서 viewport 파라미터 제거하여 지도 드래그 모드 해제
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("topLeftLat");
      newParams.delete("topLeftLng");
      newParams.delete("bottomRightLat");
      newParams.delete("bottomRightLng");
      setSearchParams(newParams, { replace: true });
    }
  };

  const handleDestinationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 다른 필터가 열려있으면 닫기 (검색바는 확장 상태 유지)
    if (showDatePicker || showGuestPicker) {
      // 체크인만 선택된 경우 체크아웃을 다음 날로 자동 설정
      if (checkIn && !checkOut && showDatePicker) {
        const nextDay = new Date(checkIn);
        nextDay.setDate(nextDay.getDate() + 1);
        setCheckOut(nextDay);
      }
      setShowDatePicker(false);
      setShowGuestPicker(false);
      // 필터 간 전환 시에는 검색바를 축소하지 않음 (확장 상태 유지)
    }
    
    // 지도 드래그 모드 해제
    exitMapDragMode();
    
    if (!isExpanded) {
      setIsExpanded(true);
      onExpandedChange?.(true);
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
    if (!isExpanded) {
      setIsExpanded(true);
      onExpandedChange?.(true);
    }
    // 달력이 닫혀있을 때만 열기 (체크인 선택 후에도 열어두기 위해)
    if (!showDatePicker) {
      setShowDatePicker(true);
    }
    setShowGuestPicker(false);
  };

  const handleGuestClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      setIsExpanded(true);
      onExpandedChange?.(true);
    }
    setShowGuestPicker(!showGuestPicker);
    setShowDatePicker(false);
  };
  
  // 검색바의 다른 영역 클릭 시 열려있는 필터 닫기
  const handleOtherAreaClick = () => {
    if (showDatePicker) {
      setShowDatePicker(false);
    }
    if (showGuestPicker) {
      setShowGuestPicker(false);
    }
  };

  const handleDateSelect = (newCheckIn: Date | null, newCheckOut: Date | null) => {
    setCheckIn(newCheckIn);
    setCheckOut(newCheckOut);
    // 날짜 선택 후에도 달력은 열어둠 (다른 영역 클릭 시에만 닫힘)
  };

  // URL 파라미터에서 초기값 읽기 (새로고침 시에도 유지)
  useEffect(() => {
    const destination = searchParams.get("destination");
    const checkInParam = searchParams.get("checkIn");
    const checkOutParam = searchParams.get("checkOut");
    const adultOccupancyParam = searchParams.get("adultOccupancy");
    const childOccupancyParam = searchParams.get("childOccupancy");
    const infantOccupancyParam = searchParams.get("infantOccupancy");
    const petOccupancyParam = searchParams.get("petOccupancy");

    // destination이 있으면 inputText 설정
    if (destination && !inputText) {
      handleInputChange(destination);
    }

    // 날짜 설정
    if (checkInParam) {
      const checkInDate = new Date(checkInParam);
      if (!isNaN(checkInDate.getTime())) {
        setCheckIn(checkInDate);
      }
    }
    if (checkOutParam) {
      const checkOutDate = new Date(checkOutParam);
      if (!isNaN(checkOutDate.getTime())) {
        setCheckOut(checkOutDate);
      }
    }

    // 인원 수 설정
    if (adultOccupancyParam) {
      const adult = parseInt(adultOccupancyParam, 10);
      if (!isNaN(adult) && adult > 0) {
        setAdultOccupancy(adult);
      }
    }
    if (childOccupancyParam) {
      const child = parseInt(childOccupancyParam, 10);
      if (!isNaN(child) && child >= 0) {
        setChildOccupancy(child);
      }
    }
    if (infantOccupancyParam) {
      const infant = parseInt(infantOccupancyParam, 10);
      if (!isNaN(infant) && infant >= 0) {
        setInfantOccupancy(infant);
      }
    }
    if (petOccupancyParam) {
      const pet = parseInt(petOccupancyParam, 10);
      if (!isNaN(pet) && pet >= 0) {
        setPetOccupancy(pet);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // DatePicker의 실제 DOM 요소 확인
      const isInsideDatePicker = datePickerElementRef.current?.contains(target);
      
      // GuestPicker의 실제 DOM 요소 확인
      const isInsideGuestPicker = guestPickerRef.current?.contains(target);
      
      // Suggestions 영역 확인
      const isInsideSuggestions = suggestionsRef.current?.contains(target);
      
      // 검색바 내부 확인
      const isInsideSearchBar = searchBarRef.current?.contains(target);
      
      // 달력이나 여행자 필터, 추천 리스트 영역 내부가 아닌 경우
      if (!isInsideDatePicker && !isInsideGuestPicker && !isInsideSuggestions) {
        // 검색바 외부를 클릭한 경우
        if (!isInsideSearchBar) {
          // 검색바 외부 클릭 시 항상 닫기
          if (showDatePicker || showGuestPicker || showSuggestions) {
            // 체크인만 선택된 경우 체크아웃을 다음 날로 자동 설정
            if (checkIn && !checkOut && showDatePicker) {
              const nextDay = new Date(checkIn);
              nextDay.setDate(nextDay.getDate() + 1);
              setCheckOut(nextDay);
            }
            setShowDatePicker(false);
            setShowGuestPicker(false);
            setShowSuggestions(false);
            // 날짜가 선택되었으면 검색바를 축소 모드로 변경
            if (checkIn || checkOut) {
              setIsExpanded(false);
              onExpandedChange?.(false);
            }
          }
          // 검색바 외부 클릭 시 항상 축소 (목적지 입력 여부와 관계없이)
          setIsExpanded(false);
          onExpandedChange?.(false);
        }
      }
    };

    if (showDatePicker || showGuestPicker || showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker, showGuestPicker, showSuggestions, checkIn, checkOut, onExpandedChange]);

  return (
    <div
      ref={searchBarRef}
      className={`${styles.searchBar} ${isExpanded ? styles.expanded : ""}`}
      onClick={handleSearchBarClick}
    >
      <div 
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
                  setTimeout(() => {
                    // 클릭한 요소가 추천 리스트 내부인지 확인
                    const activeElement = document.activeElement;
                    if (suggestionsRef.current?.contains(activeElement as Node)) {
                      return;
                    }
                    setShowSuggestions(false);
                    // 달력이 열리는 중이거나 이미 열려있으면 검색바를 축소하지 않음
                    // (엔터 키로 달력을 열 때 onBlur가 트리거되지만, 달력이 열려있으면 유지)
                    if (!isOpeningDatePicker && !showDatePicker && !showGuestPicker) {
                      // 목적지 입력 필드에서 포커스를 잃을 때 검색바 축소 (목적지 입력 여부와 관계없이)
                      setIsExpanded(false);
                      onExpandedChange?.(false);
                    }
                  }, 200);
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
                    <div
                      key={suggestion.placeId}
                      className={styles.suggestionItem}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePlaceSelect(suggestion);
                      }}
                    >
                      <div className={styles.suggestionMainText}>
                        {suggestion.mainText}
                      </div>
                      {suggestion.secondaryText && (
                        <div className={styles.suggestionSecondaryText}>
                          {suggestion.secondaryText}
                        </div>
                      )}
                    </div>
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
                    if (checkIn && !checkOut) {
                      const nextDay = new Date(checkIn);
                      nextDay.setDate(nextDay.getDate() + 1);
                      handleDateSelect(checkIn, nextDay);
                    }
                    setShowDatePicker(false);
                    // 닫기 버튼 클릭 시 검색바를 축소 모드로 변경
                    setIsExpanded(false);
                    onExpandedChange?.(false);
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
        className={styles.searchButton}
        onClick={(e) => {
          e.stopPropagation();
          // 검색 버튼 클릭 시 열려있는 필터 닫기
          if (showDatePicker || showGuestPicker) {
            // 체크인만 선택된 경우 체크아웃을 다음 날로 자동 설정
            if (checkIn && !checkOut && showDatePicker) {
              const nextDay = new Date(checkIn);
              nextDay.setDate(nextDay.getDate() + 1);
              setCheckOut(nextDay);
            }
            setShowDatePicker(false);
            setShowGuestPicker(false);
            // 날짜가 선택되었으면 검색바를 축소 모드로 변경
            if (checkIn || checkOut) {
              setIsExpanded(false);
              onExpandedChange?.(false);
            }
          }
          handleSearch(e);
        }}
      >
        <svg viewBox="0 0 32 32" fill="currentColor">
          <path d="M13 0c7.18 0 13 5.82 13 13 0 2.868-.93 5.52-2.502 7.68l7.607 7.608-1.414 1.414-7.607-7.607C18.52 25.07 15.868 26 13 26 5.82 26 0 20.18 0 13S5.82 0 13 0zm0 2C7.477 2 3 6.477 3 12s4.477 10 10 10 10-4.477 10-10S18.523 2 13 2z" />
        </svg>
      </button>
    </div>
  );
};

