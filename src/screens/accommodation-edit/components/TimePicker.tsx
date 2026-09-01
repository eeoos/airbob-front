import React, { useEffect, useRef } from "react";
import type {
  AccommodationEditTimePeriod,
  AccommodationEditTimeValueSelection,
} from "../editorViewContract";
import styles from "./TimeStep.module.css";

interface TimePickerProps {
  hour: number;
  id?: string;
  minute: number;
  pickerRef?: React.Ref<HTMLDivElement>;
  period: AccommodationEditTimePeriod;
  onSelect: (selection: AccommodationEditTimeValueSelection) => void;
  onEscape?: () => boolean | void;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  hour,
  id,
  minute,
  pickerRef,
  period,
  onSelect,
  onEscape,
}) => {
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectedButton = hourListRef.current?.querySelector(
      `.${styles.timePickerOptionSelected}`,
    ) as HTMLElement | null;
    selectedButton?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [hour]);

  useEffect(() => {
    const selectedButton = minuteListRef.current?.querySelector(
      `.${styles.timePickerOptionSelected}`,
    ) as HTMLElement | null;
    selectedButton?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [minute]);

  const handleHourChange = (value: number) => {
    if (value >= 1 && value <= 12) {
      onSelect({ unit: "hour", value });
    }
  };

  const handleMinuteChange = (value: number) => {
    if (value >= 0 && value <= 59) {
      onSelect({ unit: "minute", value });
    }
  };

  const handlePeriodChange = (newPeriod: AccommodationEditTimePeriod) => {
    onSelect({ unit: "period", value: newPeriod });
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: "hour" | "minute") => {
    if (e.key.match(/[0-9]/)) {
      const digit = parseInt(e.key, 10);
      if (type === "hour") {
        if (digit >= 1 && digit <= 9) handleHourChange(digit);
        if (digit === 0) handleHourChange(10);
      } else if (digit >= 0 && digit <= 5) {
        handleMinuteChange(digit * 5);
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      if (type === "hour") {
        const nextHour =
          e.key === "ArrowUp"
            ? hour >= 12
              ? 1
              : hour + 1
            : hour <= 1
              ? 12
              : hour - 1;
        handleHourChange(nextHour);
      } else {
        const currentIndex = minutes.findIndex((m) => m === minute);
        const nextIndex =
          e.key === "ArrowUp"
            ? currentIndex >= minutes.length - 1
              ? 0
              : currentIndex + 1
            : currentIndex <= 0
              ? minutes.length - 1
              : currentIndex - 1;
        const nextMinute = minutes[nextIndex];
        if (nextMinute !== undefined) {
          handleMinuteChange(nextMinute);
        }
      }
    }
  };

  const handlePickerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && onEscape) {
      if (onEscape() !== false) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest(`.${styles.timePickerColumn}:nth-child(2)`)) {
      handleKeyDown(event, "hour");
    } else if (target.closest(`.${styles.timePickerColumn}:nth-child(3)`)) {
      handleKeyDown(event, "minute");
    }
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i).filter(
    (m) => m % 5 === 0,
  );

  return (
    <div
      ref={pickerRef}
      id={id}
      aria-label="시간 선택"
      className={styles.timePickerDropdown}
      onKeyDownCapture={handlePickerKeyDown}
      role="dialog"
      tabIndex={-1}
    >
      <div className={styles.timePickerContent}>
        <div className={styles.timePickerColumn}>
          <div className={styles.timePickerHeader}>오전/오후</div>
          <div className={styles.timePickerList}>
            <button
              type="button"
              className={`${styles.timePickerOption} ${period === "AM" ? styles.timePickerOptionSelected : ""}`}
              onClick={() => handlePeriodChange("AM")}
            >
              오전
            </button>
            <button
              type="button"
              className={`${styles.timePickerOption} ${period === "PM" ? styles.timePickerOptionSelected : ""}`}
              onClick={() => handlePeriodChange("PM")}
            >
              오후
            </button>
          </div>
        </div>
        <div className={styles.timePickerColumn}>
          <div className={styles.timePickerHeader}>시간</div>
          <div className={styles.timePickerList} ref={hourListRef}>
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                className={`${styles.timePickerOption} ${hour === h ? styles.timePickerOptionSelected : ""}`}
                onClick={() => handleHourChange(h)}
              >
                {String(h).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.timePickerColumn}>
          <div className={styles.timePickerHeader}>분</div>
          <div className={styles.timePickerList} ref={minuteListRef}>
            {minutes.map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.timePickerOption} ${minute === m ? styles.timePickerOptionSelected : ""}`}
                onClick={() => handleMinuteChange(m)}
              >
                {String(m).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
