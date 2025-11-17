import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DatePicker } from "../DatePicker";
import styles from "./SearchBar.module.css";

interface SearchBarProps {
  onSearch?: (searchParams: SearchParams) => void;
  onExpandedChange?: (isExpanded: boolean) => void;
}

export interface SearchParams {
  destination?: string;
  checkIn?: Date;
  checkOut?: Date;
  adultOccupancy?: number;
  childOccupancy?: number;
  infantOccupancy?: number;
  petOccupancy?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onExpandedChange }) => {
  const navigate = useNavigate();
  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [adultOccupancy, setAdultOccupancy] = useState(1);
  const [childOccupancy, setChildOccupancy] = useState(0);
  const [infantOccupancy, setInfantOccupancy] = useState(0);
  const [petOccupancy, setPetOccupancy] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isOpeningDatePicker, setIsOpeningDatePicker] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const datePickerElementRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    // 검색 시 달력과 여행자 선택 창 닫기
    setShowDatePicker(false);
    setShowGuestPicker(false);

    const searchParams: SearchParams = {
      destination: destination || undefined,
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
      const params = new URLSearchParams();
      if (destination) params.set("destination", destination);
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
    
    // 검색 버튼 확인
    const isSearchButton = (target as HTMLElement).closest(`.${styles.searchButton}`);
    
    // 달력이나 여행자 필터 영역이 아닌 다른 부분을 클릭한 경우
    if (!isDatePickerArea && !isGuestPickerArea && !isDatePickerElement && !isSearchButton) {
      // 달력이나 여행자 필터가 열려있으면 닫기
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
        e.stopPropagation();
        return;
      }
      // 달력이나 여행자 필터가 열려있지 않으면 검색바 축소 (목적지 입력 여부와 관계없이)
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

  const handleDestinationClick = (e: React.MouseEvent) => {
    // 다른 필터가 열려있으면 닫기
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
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    if (!isExpanded) {
      setIsExpanded(true);
      onExpandedChange?.(true);
      // 확장 후 입력 필드에 포커스
      setTimeout(() => {
        destinationInputRef.current?.focus();
      }, 0);
    } else {
      destinationInputRef.current?.focus();
    }
  };

  const handleDestinationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중일 때는 엔터 키 처리를 하지 않음
    if (e.key === "Enter" && !isComposing) {
      e.preventDefault();
      e.stopPropagation();
      // 확장된 상태에서 엔터를 누르면 체크인/체크아웃 달력 열기
      if (isExpanded) {
        // 달력을 열기 전에 플래그 설정 (onBlur가 검색바를 축소하지 않도록)
        setIsOpeningDatePicker(true);
        setShowDatePicker(true);
        setShowGuestPicker(false);
        // 약간의 지연을 두어 상태 업데이트가 완료된 후 포커스 제거 및 플래그 해제
        setTimeout(() => {
          destinationInputRef.current?.blur();
          setIsOpeningDatePicker(false);
        }, 100);
      }
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // DatePicker의 실제 DOM 요소 확인
      const isInsideDatePicker = datePickerElementRef.current?.contains(target);
      
      // GuestPicker의 실제 DOM 요소 확인
      const isInsideGuestPicker = guestPickerRef.current?.contains(target);
      
      // 검색바 내부 확인
      const isInsideSearchBar = searchBarRef.current?.contains(target);
      
      // 달력이나 여행자 필터 영역 내부가 아닌 경우
      if (!isInsideDatePicker && !isInsideGuestPicker) {
        // 검색바 외부를 클릭한 경우
        if (!isInsideSearchBar) {
          // 검색바 외부 클릭 시 항상 닫기
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
          // 검색바 외부 클릭 시 항상 축소 (목적지 입력 여부와 관계없이)
          setIsExpanded(false);
          onExpandedChange?.(false);
        }
      }
    };

    if (showDatePicker || showGuestPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker, showGuestPicker, checkIn, checkOut, onExpandedChange]);

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
            <input
              ref={destinationInputRef}
              type="text"
              placeholder="어디로 여행가세요?"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={handleDestinationKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onBlur={(e) => {
                // 달력이 열리는 중이거나 이미 열려있으면 검색바를 축소하지 않음
                // (엔터 키로 달력을 열 때 onBlur가 트리거되지만, 달력이 열려있으면 유지)
                if (!isOpeningDatePicker && !showDatePicker && !showGuestPicker) {
                  // 목적지 입력 필드에서 포커스를 잃을 때 검색바 축소 (목적지 입력 여부와 관계없이)
                  setIsExpanded(false);
                  onExpandedChange?.(false);
                }
              }}
              className={styles.input}
              onClick={(e) => e.stopPropagation()}
            />
          </>
        ) : (
          <div className={styles.compactValue}>
            {destination || "어디든지"}
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

