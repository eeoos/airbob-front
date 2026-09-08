import React, { useCallback, useEffect, useRef, useState } from "react";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import { DatePicker } from "../../../../shared/ui/DatePicker";
import { Dialog } from "../../../../shared/ui/Dialog";
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

type MobileSearchBarProps = {
  routePort: SearchBarRoutePort;
  onSearch?: (searchParams: SearchParams) => void;
  isMapDragMode: boolean;
} & (
  | { mobileHeader: true; onMobileBack: () => void }
  | { mobileHeader: false; onMobileBack?: never }
);

const formatMobileDate = (date: Date) =>
  date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });

const MobileSearchBar: React.FC<MobileSearchBarProps> = ({
  routePort,
  onSearch,
  isMapDragMode,
  mobileHeader,
  onMobileBack,
}) => {
  const [isDestinationSearchOpen, setIsDestinationSearchOpen] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const destinationAreaRef = useRef<HTMLElement>(null);
  const datePickerElementRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const guestTriggerRef = useRef<HTMLButtonElement>(null);
  const destinationTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingPlaceSelectionRef = useRef(false);
  const setDestinationAreaRef = useCallback((element: HTMLElement | null) => {
    destinationAreaRef.current = element;
  }, []);

  const { destination, dates, guests, popover, actions, status } =
    useSearchBarState({
      routePort,
      isMapDragMode,
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
    resetSearchCriteria,
    startDestinationSession,
    handleSearch,
    exitMapDragMode,
    completeCheckoutIfNeeded,
    closeTransientPanels,
    handleDateSelect,
  } = actions;

  const {
    handleDestinationChange,
    handleDestinationFocus,
    handleDestinationEnterWithoutSuggestion,
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

  const { closeDatePopover, handleDateClick, handleGuestClick } =
    useSearchBarShellInteractions({
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

  const closeEditor = useCallback(() => {
    pendingPlaceSelectionRef.current = false;
    setIsDestinationSearchOpen(false);
    closeTransientPanels();
    collapseShell();
  }, [closeTransientPanels, collapseShell]);

  const openEditor = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      pendingPlaceSelectionRef.current = false;
      setIsDestinationSearchOpen(false);
      startDestinationSession();
      openDestination();
    },
    [openDestination, startDestinationSession],
  );

  const openDestinationSearch = useCallback(() => {
    pendingPlaceSelectionRef.current = false;
    setIsDestinationSearchOpen(true);
    startDestinationSession();
    openDestination();
  }, [openDestination, startDestinationSession]);

  useEffect(() => {
    if (!isDestinationSearchOpen) return;

    const focusTimer = window.setTimeout(
      () => destinationInputRef.current?.focus(),
      0,
    );

    return () => window.clearTimeout(focusTimer);
  }, [isDestinationSearchOpen]);

  const advanceToDate = useCallback(() => {
    pendingPlaceSelectionRef.current = false;
    setIsDestinationSearchOpen(false);
    openDatePicker();
    window.setTimeout(() => dateTriggerRef.current?.focus(), 0);
  }, [openDatePicker]);

  useEffect(() => {
    if (!pendingPlaceSelectionRef.current || !selectedPlace) return;

    advanceToDate();
  }, [advanceToDate, selectedPlace]);

  const handleDestinationBack = useCallback(() => {
    pendingPlaceSelectionRef.current = false;
    setIsDestinationSearchOpen(false);
    openDestination();
    window.setTimeout(() => destinationTriggerRef.current?.focus(), 0);
  }, [openDestination]);

  const handleDestinationSelect = useCallback(
    (suggestion: string | Parameters<typeof selectDestination>[0]) => {
      if (typeof suggestion === "string") {
        changeDestination(suggestion);
        advanceToDate();
        return;
      }

      pendingPlaceSelectionRef.current = true;
      selectDestination(suggestion);
    },
    [advanceToDate, changeDestination, selectDestination],
  );

  const handleDestinationEnter = useCallback(() => {
    pendingPlaceSelectionRef.current = false;
    setIsDestinationSearchOpen(false);
    handleDestinationEnterWithoutSuggestion();
    window.setTimeout(() => dateTriggerRef.current?.focus(), 0);
  }, [handleDestinationEnterWithoutSuggestion]);

  const advanceToGuests = useCallback(() => {
    completeCheckoutIfNeeded();
    toggleGuestPicker();
    window.setTimeout(() => guestTriggerRef.current?.focus(), 0);
  }, [completeCheckoutIfNeeded, toggleGuestPicker]);

  const clearEditor = useCallback(() => {
    resetSearchCriteria();
    pendingPlaceSelectionRef.current = false;
    setIsDestinationSearchOpen(false);
    openDestination();
  }, [openDestination, resetSearchCriteria]);

  const submitSearch = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (isPlacesLoading) return;

      if (activePopover === "date" || activePopover === "guests") {
        closeTransientPanels({ collapseWhenDateSelected: true });
      }

      handleSearch(event);
      collapseShell();
    },
    [
      activePopover,
      closeTransientPanels,
      collapseShell,
      handleSearch,
      isPlacesLoading,
    ],
  );

  const handleDestinationEscape = useCallback(() => {
    if (isDestinationSearchOpen) {
      handleDestinationBack();
      return;
    }

    closeEditor();
  }, [closeEditor, handleDestinationBack, isDestinationSearchOpen]);

  const destinationLabel = isMapDragMode
    ? "지도에 표시된 지역의 숙소"
    : inputText || "어디든지";
  const dateLabel =
    checkIn && checkOut
      ? `${formatMobileDate(checkIn)} – ${formatMobileDate(checkOut)}`
      : "언제든지";
  const summaryLabel = `${dateLabel} · 게스트 ${totalGuests}명`;

  return (
    <>
      <div
        ref={isExpanded ? undefined : searchBarRef}
        aria-hidden={isExpanded || undefined}
        aria-label="숙소 검색"
        className={mobileHeader ? styles.mobileHeaderBar : styles.mobileHomeBar}
        inert={isExpanded || undefined}
        role="search"
      >
        {mobileHeader ? (
          <>
            <button
              aria-label="이전 화면으로"
              className={styles.mobileHeaderIconButton}
              onClick={onMobileBack}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <button
              aria-label={`${destinationLabel}, ${summaryLabel}, 검색 조건 수정`}
              className={styles.mobileSearchSummary}
              onClick={openEditor}
              type="button"
            >
              <span className={styles.mobileSearchSummaryPrimary}>
                {destinationLabel}
              </span>
              <span className={styles.mobileSearchSummarySecondary}>
                {summaryLabel}
              </span>
            </button>

            <button
              aria-label="검색 조건 수정"
              className={styles.mobileHeaderIconButton}
              onClick={openEditor}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
              </svg>
            </button>
          </>
        ) : (
          <button
            aria-haspopup="dialog"
            aria-expanded={isExpanded}
            className={styles.mobileHomeSearchButton}
            onClick={openEditor}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <span>검색을 시작해 보세요</span>
          </button>
        )}
      </div>

      <Dialog
        bodyClassName={requireCssModuleClass(styles.mobileDialogBody)}
        bodyPadding="none"
        className={requireCssModuleClass(styles.mobileDialog)}
        closeOnBackdrop={false}
        isOpen={isExpanded}
        onClose={closeEditor}
        showHeader={false}
        size="custom"
        title="숙소 검색"
      >
        <div
          ref={searchBarRef}
          className={styles.mobileEditor}
          data-expanded=""
          role="search"
        >
          {isDestinationSearchOpen ? (
            <section
              aria-labelledby="mobile-destination-search-title"
              className={styles.mobileDestinationPanel}
            >
              <h2
                className={styles.visuallyHidden}
                id="mobile-destination-search-title"
              >
                여행지 검색
              </h2>
              <div className={styles.mobileDestinationSearchControl}>
                <button
                  aria-label="검색 조건으로 돌아가기"
                  className={styles.mobileDestinationBackButton}
                  onClick={handleDestinationBack}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <div
                  ref={setDestinationAreaRef}
                  className={`${styles.searchItem} ${styles.destinationItem}`}
                >
                  <SearchDestinationField
                    inputRef={destinationInputRef}
                    isActive={showSuggestions}
                    isComposing={isComposing}
                    isLoading={isPlacesLoading}
                    onChange={handleDestinationChange}
                    onClear={clearDestinationSelection}
                    onCompositionEnd={endComposition}
                    onCompositionStart={startComposition}
                    onEnterWithoutSuggestion={handleDestinationEnter}
                    onEscape={handleDestinationEscape}
                    onFocus={handleDestinationFocus}
                    onInputClick={(event) => event.stopPropagation()}
                    onRequestSuggestions={openDestination}
                    onSelect={handleDestinationSelect}
                    showClearButton
                    showSuggestionIcons
                    shouldClearOnValueChange={!!selectedPlace}
                    suggestions={suggestions}
                    suggestionsRef={suggestionsRef}
                    value={inputText}
                  />
                </div>
              </div>
            </section>
          ) : (
            <>
              <div className={styles.mobileEditorHeader}>
                <strong>숙소 검색</strong>
                <button
                  aria-label="검색 닫기"
                  className={styles.mobileCloseButton}
                  onClick={closeEditor}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <div className={styles.mobileEditorContent}>
                <section
                  className={`${styles.mobileEditorCard} ${
                    activePopover === "destination"
                      ? styles.mobileEditorCardActive
                      : styles.mobileEditorCardCollapsed
                  }`}
                >
                  {activePopover === "destination" ? (
                    <>
                      <h2 className={styles.mobileEditorCardTitle}>위치</h2>
                      <button
                        ref={destinationTriggerRef}
                        aria-label={`${destinationLabel}, 여행지 검색 열기`}
                        className={styles.mobileDestinationPrompt}
                        onClick={openDestinationSearch}
                        type="button"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="6" />
                          <path d="m16 16 4 4" />
                        </svg>
                        <span>
                          {isMapDragMode
                            ? "지도 표시 지역"
                            : inputText || "여행지 검색"}
                        </span>
                      </button>
                    </>
                  ) : (
                    <button
                      ref={destinationTriggerRef}
                      className={styles.mobileCollapsedCriteria}
                      onClick={openDestinationSearch}
                      type="button"
                    >
                      <span>여행지</span>
                      <strong>{destinationLabel}</strong>
                    </button>
                  )}
                </section>

                <section
                  className={`${styles.mobileEditorCard} ${
                    activePopover === "date"
                      ? styles.mobileEditorCardActive
                      : ""
                  }`}
                >
                  <div
                    className={`${styles.searchItemHost} ${styles.dateItemHost}`}
                    ref={datePickerRef}
                  >
                    <SearchDateFields
                      checkIn={checkIn}
                      checkOut={checkOut}
                      isExpanded
                      isOpen={showDatePicker}
                      leadingLabel="날짜"
                      onTriggerClick={handleDateClick}
                      triggerRef={dateTriggerRef}
                    />
                    {showDatePicker && (
                      <SearchBarPopover
                        id="search-date-picker"
                        triggerRef={dateTriggerRef}
                        variant="date"
                        onClose={closeDateAndRestoreFocus}
                      >
                        <DatePicker
                          checkIn={checkIn}
                          checkOut={checkOut}
                          datePickerRef={datePickerElementRef}
                          hideFooter
                          onClose={advanceToGuests}
                          onDateSelect={handleDateSelect}
                          onEscape={closeDateAndRestoreFocus}
                        />
                      </SearchBarPopover>
                    )}
                  </div>
                </section>

                <section
                  className={`${styles.mobileEditorCard} ${
                    activePopover === "guests"
                      ? styles.mobileEditorCardActive
                      : ""
                  }`}
                >
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
                      onClick={handleGuestClick}
                      type="button"
                    >
                      <div className={styles.label}>여행자</div>
                      <div className={styles.value}>
                        {totalGuests > 0
                          ? `게스트 ${totalGuests}명`
                          : "게스트 추가"}
                      </div>
                    </button>
                    {showGuestPicker && (
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
                          onAdultChange={changeAdultOccupancy}
                          onChildChange={changeChildOccupancy}
                          onInfantChange={changeInfantOccupancy}
                          onPetChange={changePetOccupancy}
                          petOccupancy={petOccupancy}
                        />
                      </SearchBarPopover>
                    )}
                  </div>
                </section>
              </div>

              <div className={styles.mobileEditorFooter}>
                {activePopover === "date" ? (
                  <>
                    <button
                      className={styles.mobileClearButton}
                      onClick={() => handleDateSelect(null, null)}
                      type="button"
                    >
                      재설정
                    </button>
                    <button
                      className={styles.mobileSubmitButton}
                      onClick={advanceToGuests}
                      type="button"
                    >
                      다음
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={styles.mobileClearButton}
                      onClick={clearEditor}
                      type="button"
                    >
                      전체 삭제
                    </button>
                    <button
                      className={styles.mobileSubmitButton}
                      disabled={isPlacesLoading}
                      onClick={submitSearch}
                      type="button"
                    >
                      <svg aria-hidden="true" viewBox="0 0 32 32">
                        <path d="M13 0c7.18 0 13 5.82 13 13 0 2.868-.93 5.52-2.502 7.68l7.607 7.608-1.414 1.414-7.607-7.607C18.52 25.07 15.868 26 13 26 5.82 26 0 20.18 0 13S5.82 0 13 0zm0 2C7.477 2 3 6.477 3 12s4.477 10 10 10 10-4.477 10-10S18.523 2 13 2z" />
                      </svg>
                      검색
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
};

export default MobileSearchBar;
