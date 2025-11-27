import React, { useState, useRef, useEffect } from "react";
import styles from "./DatePicker.module.css";

interface DatePickerProps {
  checkIn: Date | null;
  checkOut: Date | null;
  onDateSelect: (checkIn: Date | null, checkOut: Date | null) => void;
  onClose: () => void;
  datePickerRef?: React.RefObject<HTMLDivElement | null>;
  unavailableDates?: string[]; // YYYY-MM-DD 형식의 날짜 배열
  hideHeader?: boolean;
  hideFooter?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
  checkIn,
  checkOut,
  onDateSelect,
  onClose,
  datePickerRef,
  unavailableDates = [],
  hideHeader = false,
  hideFooter = false,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(
    checkIn || new Date()
  );
  const [nextMonth, setNextMonth] = useState<Date>(() => {
    const date = checkIn || new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  });
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const internalPickerRef = useRef<HTMLDivElement>(null);
  const pickerRef = datePickerRef || internalPickerRef;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // 첫 주의 빈 칸 채우기 (null로 표시)
    const startDay = firstDay.getDay();
    for (let i = 0; i < startDay; i++) {
      days.push(null as any); // 빈 칸
    }

    // 해당 월의 날짜들만 추가
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    // 항상 6주(42일)를 보장하기 위해 빈 칸 채우기
    const totalDays = days.length;
    const remainingDays = 42 - totalDays;
    for (let i = 0; i < remainingDays; i++) {
      days.push(null as any); // 빈 칸
    }

    return days;
  };

  const isDateInRange = (date: Date): boolean => {
    if (!checkIn || !checkOut) return false;
    const dateStr = formatDateKey(date);
    const checkInStr = formatDateKey(checkIn);
    const checkOutStr = formatDateKey(checkOut);
    return dateStr > checkInStr && dateStr < checkOutStr;
  };

  const isDateSelected = (date: Date): boolean => {
    if (!checkIn && !checkOut) return false;
    const dateStr = formatDateKey(date);
    return (
      (checkIn !== null && formatDateKey(checkIn) === dateStr) ||
      (checkOut !== null && formatDateKey(checkOut) === dateStr)
    );
  };

  const isDateInHoverRange = (date: Date): boolean => {
    if (!checkIn || checkOut || !hoverDate) return false;
    const dateStr = formatDateKey(date);
    const checkInStr = formatDateKey(checkIn);
    const hoverStr = formatDateKey(hoverDate);
    if (hoverDate > checkIn) {
      return dateStr > checkInStr && dateStr < hoverStr;
    }
    return false;
  };

  const formatDateKey = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const isDateDisabled = (date: Date): boolean => {
    const dateStr = formatDateKey(date);
    const todayStr = formatDateKey(today);
    
    // 과거 날짜는 비활성화
    if (dateStr < todayStr) {
      return true;
    }
    
    // unavailable_dates에 포함된 날짜는 비활성화
    if (unavailableDates.includes(dateStr)) {
      return true;
    }
    
    // 체크인이 선택된 경우, 체크인 이전 날짜는 비활성화
    if (checkIn && !checkOut) {
      const checkInStr = formatDateKey(checkIn);
      return dateStr <= checkInStr;
    }
    
    return false;
  };
  
  const isPastDate = (date: Date): boolean => {
    const dateStr = formatDateKey(date);
    const todayStr = formatDateKey(today);
    return dateStr < todayStr;
  };
  
  const isUnavailableDate = (date: Date): boolean => {
    const dateStr = formatDateKey(date);
    return unavailableDates.includes(dateStr);
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) {
      return;
    }

    const dateStr = formatDateKey(date);
    const todayStr = formatDateKey(today);
    
    // 과거 날짜는 선택 불가
    if (dateStr < todayStr) {
      return;
    }

    if (!checkIn || (checkIn && checkOut)) {
      // 체크인 선택 (또는 기존 선택 초기화 후 체크인 재선택)
      onDateSelect(date, null);
    } else if (checkIn && !checkOut) {
      // 체크아웃 선택 - 체크인 이후 날짜만 선택 가능
      const checkInStr = formatDateKey(checkIn);
      if (dateStr > checkInStr) {
        onDateSelect(checkIn, date);
      } else {
        // 체크인 이전 날짜를 클릭하면 체크인을 다시 선택
        onDateSelect(date, null);
      }
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setNextMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setNextMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 1));
  };

  const renderCalendar = (month: Date) => {
    const days = getDaysInMonth(month);
    const monthName = month.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

    return (
      <div className={styles.calendar}>
        <div className={styles.monthHeader}>
          <h3 className={styles.monthName}>{monthName}</h3>
        </div>
        <div className={styles.weekdays}>
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <div key={day} className={styles.weekday}>
              {day}
            </div>
          ))}
        </div>
        <div className={styles.days}>
          {days.map((date, index) => {
            // null인 경우 빈 칸으로 표시
            if (!date) {
              return <div key={index} className={`${styles.day} ${styles.empty}`} />;
            }

            const dateStr = formatDateKey(date);
            const isCurrentMonth = date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
            // 해당 달력의 월에 속하는 날짜만 선택된 것으로 표시
            const isSelected = isCurrentMonth && isDateSelected(date);
            const isInRange = isCurrentMonth && isDateInRange(date);
            const isInHoverRange = isCurrentMonth && isDateInHoverRange(date);
            const isDisabled = isDateDisabled(date);
            const isPast = isPastDate(date);
            const isUnavailable = isUnavailableDate(date);
            // 해당 달력의 월에 속하는 날짜만 시작/끝으로 표시
            const isStart = isCurrentMonth && checkIn && formatDateKey(checkIn) === dateStr;
            const isEnd = isCurrentMonth && checkOut && formatDateKey(checkOut) === dateStr;

            return (
              <div
                key={index}
                className={`${styles.day} ${
                  isSelected ? styles.selected : ""
                } ${isInRange || isInHoverRange ? styles.inRange : ""} ${
                  isDisabled ? styles.disabled : ""
                } ${isPast ? styles.past : ""} ${
                  isUnavailable ? styles.unavailable : ""
                } ${isStart ? styles.start : ""} ${isEnd ? styles.end : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDateClick(date);
                }}
                onMouseEnter={() => {
                  if (checkIn && !checkOut) {
                    setHoverDate(date);
                  }
                }}
                onMouseLeave={() => setHoverDate(null)}
              >
                <span className={styles.dayNumber}>{date.getDate()}</span>
                {(isPast || isUnavailable) && <span className={styles.dayStrike}>−</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const formatDateForDisplay = (date: Date | null): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}. ${month}. ${day}.`;
  };

  const formatDateRange = (): string => {
    if (!checkIn || !checkOut) return "";
    const year = checkIn.getFullYear();
    const month = checkIn.getMonth() + 1;
    const day = checkIn.getDate();
    const endYear = checkOut.getFullYear();
    const endMonth = checkOut.getMonth() + 1;
    const endDay = checkOut.getDate();
    return `${year}년 ${month}월 ${day}일 - ${endYear}년 ${endMonth}월 ${endDay}일`;
  };

  return (
    <div className={styles.datePicker} ref={pickerRef}>
      {/* 네비게이션 헤더 - 이전/다음 버튼 같은 행 */}
      <div className={styles.navHeader}>
        <button className={styles.monthNavButton} onClick={handlePrevMonth}>
          ←
        </button>
        <span className={styles.navTitle}>
          {currentMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })}
        </span>
        <button className={styles.monthNavButton} onClick={handleNextMonth}>
          →
        </button>
      </div>
      
      {/* 스크롤 가능한 달력 영역 */}
      <div className={styles.calendarsScrollArea}>
        <div className={styles.calendars}>
          <div className={styles.calendarWrapper}>
            {renderCalendar(currentMonth)}
          </div>
          <div className={styles.calendarWrapper}>
            {renderCalendar(nextMonth)}
          </div>
        </div>
      </div>
      
      {!hideFooter && (
        <div className={styles.footer}>
          <button className={styles.clearButton} onClick={() => onDateSelect(null, null)}>
            날짜 지우기
          </button>
          <button className={styles.closeButton} onClick={onClose}>
            닫기
          </button>
        </div>
      )}
    </div>
  );
};

export default DatePicker;

