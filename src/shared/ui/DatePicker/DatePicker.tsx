import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DAYS_PER_WEEK,
  WEEKDAYS,
  addDays,
  addMonths,
  addMonthsPreservingDay,
  findClosestEnabledDate,
  formatDateKey,
  formatKoreanDateLabel,
  formatMonthName,
  getCalendarWeeks,
  getMonthIndex,
  getSelectionAnnouncement,
  startOfDay,
  startOfMonth,
} from "./datePickerModel";
import styles from "./DatePicker.module.css";

export interface DatePickerProps {
  checkIn: Date | null;
  checkOut: Date | null;
  onDateSelect: (checkIn: Date | null, checkOut: Date | null) => void;
  onClose: () => void;
  onEscape?: () => void;
  datePickerRef?: React.RefObject<HTMLDivElement | null>;
  unavailableDates?: string[];
  hideFooter?: boolean;
}

const EMPTY_UNAVAILABLE_DATES: string[] = [];

export const DatePicker: React.FC<DatePickerProps> = ({
  checkIn,
  checkOut,
  onDateSelect,
  onClose,
  onEscape,
  datePickerRef,
  unavailableDates = EMPTY_UNAVAILABLE_DATES,
  hideFooter = false,
}) => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = formatDateKey(today);
  const checkInKey = checkIn ? formatDateKey(checkIn) : null;
  const checkOutKey = checkOut ? formatDateKey(checkOut) : null;
  const unavailableDateKeys = useMemo(
    () => new Set(unavailableDates),
    [unavailableDates],
  );
  const firstUnavailableDateKeyAfterCheckIn = useMemo(() => {
    if (!checkInKey || checkOutKey) return null;

    return (
      unavailableDates
        .filter((dateKey) => dateKey > checkInKey)
        .sort()[0] ?? null
    );
  }, [checkInKey, checkOutKey, unavailableDates]);
  const isDateDisabled = useCallback(
    (date: Date): boolean => {
      const dateKey = formatDateKey(date);

      if (dateKey < todayKey) {
        return true;
      }

      if (checkInKey && !checkOutKey) {
        return (
          dateKey <= checkInKey ||
          (firstUnavailableDateKeyAfterCheckIn !== null &&
            dateKey > firstUnavailableDateKeyAfterCheckIn)
        );
      }

      return unavailableDateKeys.has(dateKey) && dateKey !== checkOutKey;
    },
    [
      checkInKey,
      checkOutKey,
      firstUnavailableDateKeyAfterCheckIn,
      todayKey,
      unavailableDateKeys,
    ],
  );
  const initialFocusedDate = useMemo(
    () =>
      findClosestEnabledDate(checkIn ?? today, 1, isDateDisabled) ?? today,
    [checkIn, isDateDisabled, today],
  );
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    startOfMonth(initialFocusedDate),
  );
  const [focusedDate, setFocusedDate] = useState<Date>(initialFocusedDate);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const focusedDateKey = formatDateKey(focusedDate);
  const hoverDateKey = hoverDate ? formatDateKey(hoverDate) : null;
  const [selectionAnnouncement, setSelectionAnnouncement] = useState(() =>
    getSelectionAnnouncement(checkIn, checkOut),
  );
  const nextMonth = useMemo(() => addMonths(currentMonth, 1), [currentMonth]);
  const currentMonthWeeks = useMemo(
    () => getCalendarWeeks(currentMonth),
    [currentMonth],
  );
  const nextMonthWeeks = useMemo(
    () => getCalendarWeeks(nextMonth),
    [nextMonth],
  );
  const internalPickerRef = useRef<HTMLDivElement>(null);
  const pickerRef = datePickerRef ?? internalPickerRef;
  const dateCellRefs = useRef(new Map<string, HTMLButtonElement>());
  const shouldFocusDateRef = useRef(true);
  const pickerId = useId();

  useEffect(() => {
    setSelectionAnnouncement(getSelectionAnnouncement(checkIn, checkOut));
  }, [checkIn, checkOut]);

  useEffect(() => {
    if (!shouldFocusDateRef.current) return;

    shouldFocusDateRef.current = false;
    dateCellRefs.current.get(formatDateKey(focusedDate))?.focus();
  }, [currentMonth, focusedDate]);

  const isDateInRange = (date: Date): boolean => {
    if (!checkInKey || !checkOutKey) return false;
    const dateKey = formatDateKey(date);
    return dateKey > checkInKey && dateKey < checkOutKey;
  };

  const isDateSelected = (date: Date): boolean => {
    const dateKey = formatDateKey(date);
    return dateKey === checkInKey || dateKey === checkOutKey;
  };

  const isDateInHoverRange = (date: Date): boolean => {
    if (
      !checkInKey ||
      checkOutKey ||
      !hoverDateKey ||
      !hoverDate ||
      isDateDisabled(hoverDate)
    ) {
      return false;
    }

    const dateKey = formatDateKey(date);
    return dateKey > checkInKey && dateKey < hoverDateKey;
  };

  const isPastDate = (date: Date): boolean => formatDateKey(date) < todayKey;

  const isUnavailableDate = (date: Date): boolean =>
    unavailableDateKeys.has(formatDateKey(date));

  const ensureDateIsVisible = useCallback(
    (date: Date) => {
      const targetMonthIndex = getMonthIndex(date);
      const currentMonthIndex = getMonthIndex(currentMonth);
      const nextMonthIndex = getMonthIndex(nextMonth);

      if (targetMonthIndex < currentMonthIndex) {
        setCurrentMonth(startOfMonth(date));
      } else if (targetMonthIndex > nextMonthIndex) {
        setCurrentMonth(addMonths(date, -1));
      }
    },
    [currentMonth, nextMonth],
  );

  const moveDateFocus = useCallback(
    (targetDate: Date, preferredDirection: -1 | 1) => {
      const nextFocusedDate = findClosestEnabledDate(
        targetDate,
        preferredDirection,
        isDateDisabled,
      );

      if (!nextFocusedDate) return;

      ensureDateIsVisible(nextFocusedDate);
      shouldFocusDateRef.current = true;
      setFocusedDate(nextFocusedDate);
    },
    [ensureDateIsVisible, isDateDisabled],
  );

  useEffect(() => {
    if (!isDateDisabled(focusedDate)) return;

    moveDateFocus(addDays(focusedDate, 1), 1);
  }, [focusedDate, isDateDisabled, moveDateFocus]);

  const selectDate = useCallback(
    (date: Date) => {
      if (isDateDisabled(date)) return;

      shouldFocusDateRef.current = false;
      setFocusedDate(date);

      if (!checkIn || checkOut) {
        onDateSelect(date, null);
        setSelectionAnnouncement(
          `${formatKoreanDateLabel(
            date,
          )} 체크인 선택됨. 체크아웃 날짜를 선택하세요.`,
        );
        return;
      }

      onDateSelect(checkIn, date);
      setSelectionAnnouncement(
        `${formatKoreanDateLabel(checkIn)}부터 ${formatKoreanDateLabel(
          date,
        )}까지 선택됨`,
      );
    },
    [checkIn, checkOut, isDateDisabled, onDateSelect],
  );

  const handleDateKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, date: Date) => {
      let targetDate: Date | null = null;
      let preferredDirection: -1 | 1 = 1;

      switch (event.key) {
        case "ArrowLeft":
          targetDate = addDays(date, -1);
          preferredDirection = -1;
          break;
        case "ArrowRight":
          targetDate = addDays(date, 1);
          break;
        case "ArrowUp":
          targetDate = addDays(date, -DAYS_PER_WEEK);
          preferredDirection = -1;
          break;
        case "ArrowDown":
          targetDate = addDays(date, DAYS_PER_WEEK);
          break;
        case "Home":
          targetDate = addDays(date, -date.getDay());
          break;
        case "End":
          targetDate = addDays(date, DAYS_PER_WEEK - 1 - date.getDay());
          preferredDirection = -1;
          break;
        case "PageUp":
          targetDate = addMonthsPreservingDay(date, -1);
          preferredDirection = -1;
          break;
        case "PageDown":
          targetDate = addMonthsPreservingDay(date, 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          selectDate(date);
          return;
        default:
          return;
      }

      event.preventDefault();
      moveDateFocus(targetDate, preferredDirection);
    },
    [moveDateFocus, selectDate],
  );

  const moveVisibleMonth = (amount: -1 | 1) => {
    const nextCurrentMonth = addMonths(currentMonth, amount);
    const preferredDate = addMonthsPreservingDay(focusedDate, amount);
    const nextFocusedDate = findClosestEnabledDate(
      preferredDate,
      amount,
      isDateDisabled,
    );

    if (!nextFocusedDate) return;

    const nextFocusedMonthIndex = getMonthIndex(nextFocusedDate);
    const nextCurrentMonthIndex = getMonthIndex(nextCurrentMonth);

    if (
      nextFocusedMonthIndex < nextCurrentMonthIndex ||
      nextFocusedMonthIndex > nextCurrentMonthIndex + 1
    ) {
      return;
    }

    setCurrentMonth(nextCurrentMonth);
    shouldFocusDateRef.current = false;
    setFocusedDate(nextFocusedDate);
  };

  const renderCalendar = (
    month: Date,
    calendarWeeks: Array<Array<Date | null>>,
  ) => {
    const monthName = formatMonthName(month);
    const monthKey = formatDateKey(month);
    const monthHeadingId = `${pickerId}-${monthKey}`;

    return (
      <div className={styles.calendar}>
        <div className={styles.monthHeader}>
          <h3 id={monthHeadingId} className={styles.monthName}>
            {monthName}
          </h3>
        </div>
        <div
          className={styles.calendarGrid}
          role="grid"
          aria-labelledby={monthHeadingId}
        >
          <div className={styles.weekdays} role="row">
            {WEEKDAYS.map((day) => (
              <div
                key={day.short}
                className={styles.weekday}
                role="columnheader"
                aria-label={day.long}
              >
                {day.short}
              </div>
            ))}
          </div>
          <div className={styles.days} role="rowgroup">
            {calendarWeeks.map((week, weekIndex) => (
              <div
                key={`${monthKey}-week-${weekIndex}`}
                className={styles.week}
                role="row"
              >
                {week.map((date, dayIndex) => {
                  if (!date) {
                    return (
                      <div
                        key={`empty-${weekIndex}-${dayIndex}`}
                        className={`${styles.day} ${styles.empty}`}
                        role="gridcell"
                        aria-hidden="true"
                      />
                    );
                  }

                  const dateKey = formatDateKey(date);
                  const isSelected = isDateSelected(date);
                  const isInRange = isDateInRange(date);
                  const isInHoverRange = isDateInHoverRange(date);
                  const isDisabled = isDateDisabled(date);
                  const isPast = isPastDate(date);
                  const isUnavailable =
                    isDisabled && isUnavailableDate(date);
                  const isStart = dateKey === checkInKey;
                  const isEnd = dateKey === checkOutKey;

                  return (
                    <button
                      key={dateKey}
                      ref={(element) => {
                        if (element) {
                          dateCellRefs.current.set(dateKey, element);
                        } else {
                          dateCellRefs.current.delete(dateKey);
                        }
                      }}
                      type="button"
                      role="gridcell"
                      aria-label={formatKoreanDateLabel(date)}
                      aria-selected={isSelected}
                      aria-disabled={isDisabled}
                      disabled={isDisabled}
                      tabIndex={
                        !isDisabled && focusedDateKey === dateKey ? 0 : -1
                      }
                      className={`${styles.day} ${
                        isSelected ? styles.selected : ""
                      } ${isInRange || isInHoverRange ? styles.inRange : ""} ${
                        isDisabled ? styles.disabled : ""
                      } ${isPast ? styles.past : ""} ${
                        isUnavailable ? styles.unavailable : ""
                      } ${isStart ? styles.start : ""} ${
                        isEnd ? styles.end : ""
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectDate(date);
                      }}
                      onKeyDown={(event) => handleDateKeyDown(event, date)}
                      onMouseEnter={() => {
                        if (checkIn && !checkOut && !isDisabled) {
                          setHoverDate(date);
                        }
                      }}
                      onMouseLeave={() => setHoverDate(null)}
                    >
                      <span className={styles.dayNumber}>{date.getDate()}</span>
                      {(isPast || isUnavailable) && (
                        <span className={styles.dayStrike}>−</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handlePickerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;

    event.preventDefault();
    event.stopPropagation();
    (onEscape ?? onClose)();
  };

  return (
    <div
      className={styles.datePicker}
      ref={pickerRef}
      onKeyDown={handlePickerKeyDown}
    >
      <div className={styles.navHeader}>
        <button
          aria-label="이전 달 보기"
          className={styles.monthNavButton}
          type="button"
          onClick={() => moveVisibleMonth(-1)}
        >
          ←
        </button>
        <span className={styles.navTitle}>{formatMonthName(currentMonth)}</span>
        <button
          aria-label="다음 달 보기"
          className={styles.monthNavButton}
          type="button"
          onClick={() => moveVisibleMonth(1)}
        >
          →
        </button>
      </div>

      <div className={styles.calendarsScrollArea}>
        <div className={styles.calendars}>
          <div className={styles.calendarWrapper}>
            {renderCalendar(currentMonth, currentMonthWeeks)}
          </div>
          <div className={styles.calendarWrapper}>
            {renderCalendar(nextMonth, nextMonthWeeks)}
          </div>
        </div>
      </div>

      <div
        className={styles.liveRegion}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {selectionAnnouncement}
      </div>

      {!hideFooter && (
        <div className={styles.footer}>
          <button
            className={styles.clearButton}
            type="button"
            onClick={() => {
              onDateSelect(null, null);
              setSelectionAnnouncement("선택한 날짜가 지워졌습니다.");
            }}
          >
            날짜 지우기
          </button>
          <button className={styles.closeButton} type="button" onClick={onClose}>
            닫기
          </button>
        </div>
      )}
    </div>
  );
};
