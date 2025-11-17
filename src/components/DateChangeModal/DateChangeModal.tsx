import React, { useState } from "react";
import styles from "./DateChangeModal.module.css";

interface DateChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkIn: Date | null;
  checkOut: Date | null;
  onDateSelect: (checkIn: Date | null, checkOut: Date | null) => void;
  unavailableDates?: string[];
  onSave: () => void;
}

const DateChangeModal: React.FC<DateChangeModalProps> = ({
  isOpen,
  onClose,
  checkIn,
  checkOut,
  onDateSelect,
  unavailableDates = [],
  onSave,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(
    checkIn || new Date()
  );
  const [nextMonth, setNextMonth] = useState<Date>(() => {
    const date = checkIn || new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  });
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  if (!isOpen) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDateKey = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const isDateDisabled = (date: Date): boolean => {
    const dateStr = formatDateKey(date);
    const todayStr = formatDateKey(today);
    
    if (dateStr < todayStr) {
      return true;
    }
    
    if (unavailableDates.includes(dateStr)) {
      return true;
    }
    
    if (checkIn && !checkOut) {
      const checkInStr = formatDateKey(checkIn);
      return dateStr <= checkInStr;
    }
    
    return false;
  };

  const isDateSelected = (date: Date): boolean => {
    if (!checkIn && !checkOut) return false;
    const dateStr = formatDateKey(date);
    return (
      (checkIn !== null && formatDateKey(checkIn) === dateStr) ||
      (checkOut !== null && formatDateKey(checkOut) === dateStr)
    );
  };

  const isDateInRange = (date: Date): boolean => {
    if (!checkIn || !checkOut) return false;
    const dateStr = formatDateKey(date);
    const checkInStr = formatDateKey(checkIn);
    const checkOutStr = formatDateKey(checkOut);
    return dateStr > checkInStr && dateStr < checkOutStr;
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

  const getDaysInMonth = (date: Date): (Date | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    const startDay = firstDay.getDay();
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    const endDay = lastDay.getDay();
    const remainingDays = 6 - endDay;
    for (let i = 0; i < remainingDays; i++) {
      days.push(null);
    }

    return days;
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) {
      return;
    }

    const dateStr = formatDateKey(date);
    const todayStr = formatDateKey(today);
    
    if (dateStr < todayStr) {
      return;
    }

    if (!checkIn || (checkIn && checkOut)) {
      onDateSelect(date, null);
    } else if (checkIn && !checkOut) {
      const checkInStr = formatDateKey(checkIn);
      if (dateStr > checkInStr) {
        onDateSelect(checkIn, date);
      } else {
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
    const monthName = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;

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
            if (!date) {
              return <div key={index} className={`${styles.day} ${styles.empty}`} />;
            }

            const dateStr = formatDateKey(date);
            const isCurrentMonth = date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
            const isSelected = isCurrentMonth && isDateSelected(date);
            const isInRange = isCurrentMonth && isDateInRange(date);
            const isInHoverRange = isCurrentMonth && isDateInHoverRange(date);
            const isDisabled = isDateDisabled(date);
            const isStart = isCurrentMonth && checkIn && formatDateKey(checkIn) === dateStr;
            const isEnd = isCurrentMonth && checkOut && formatDateKey(checkOut) === dateStr;

            return (
              <div
                key={index}
                className={`${styles.day} ${
                  isSelected ? styles.selected : ""
                } ${isInRange || isInHoverRange ? styles.inRange : ""} ${
                  isDisabled ? styles.disabled : ""
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
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleClear = () => {
    onDateSelect(null, null);
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>날짜 변경</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.calendars}>
            <div className={styles.calendarWrapper}>
              <button className={styles.monthNavButton} onClick={handlePrevMonth}>
                ←
              </button>
              {renderCalendar(currentMonth)}
            </div>
            <div className={styles.calendarWrapper}>
              {renderCalendar(nextMonth)}
              <button className={styles.monthNavButton} onClick={handleNextMonth}>
                →
              </button>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.clearButton} onClick={handleClear}>
            날짜 지우기
          </button>
          <button className={styles.saveButton} onClick={onSave}>
            저장
          </button>
        </div>
      </div>
    </>
  );
};

export default DateChangeModal;
