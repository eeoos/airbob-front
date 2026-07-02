import React from "react";
import { parseTime } from "../../../features/accommodations/edit/lib/time";
import styles from "../AccommodationEdit.module.css";
import { TimeIcon } from "./accommodationEditIcons";
import { TimePicker } from "./TimePicker";

interface TimeStepProps {
  checkInTime: string;
  checkOutTime: string;
  openTimePicker: "checkIn" | "checkOut" | null;
  setOpenTimePicker: React.Dispatch<
    React.SetStateAction<"checkIn" | "checkOut" | null>
  >;
  onTimeChange: (
    type: "checkIn" | "checkOut",
    hour: number,
    minute: number,
    period: "AM" | "PM"
  ) => void;
}

export const TimeStep: React.FC<TimeStepProps> = ({
  checkInTime,
  checkOutTime,
  openTimePicker,
  setOpenTimePicker,
  onTimeChange,
}) => {
  const checkInParsed = parseTime(checkInTime);
  const checkOutParsed = parseTime(checkOutTime);

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>체크인/체크아웃 시간을 설정하세요</h2>
      <p className={styles.stepDescription}>게스트가 체크인하고 체크아웃할 수 있는 시간을 설정해주세요.</p>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>
            체크인 시간 <span className={styles.required}>*</span>
          </label>
          <div className={styles.timeInputContainer}>
            <button
              type="button"
              className={styles.timeInputButton}
              onClick={() =>
                setOpenTimePicker(openTimePicker === "checkIn" ? null : "checkIn")
              }
            >
              <span className={styles.timeDisplay}>
                {checkInParsed.period === "AM" ? "오전" : "오후"} {String(checkInParsed.hour).padStart(2, "0")}:{String(checkInParsed.minute).padStart(2, "0")}
              </span>
              <TimeIcon />
            </button>
            {openTimePicker === "checkIn" && (
              <TimePicker
                hour={checkInParsed.hour}
                minute={checkInParsed.minute}
                period={checkInParsed.period}
                onChange={(h, m, p) => onTimeChange("checkIn", h, m, p)}
                onClose={() => setOpenTimePicker(null)}
              />
            )}
          </div>
          <p className={styles.helperText}>게스트가 체크인할 수 있는 시간입니다.</p>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            체크아웃 시간 <span className={styles.required}>*</span>
          </label>
          <div className={styles.timeInputContainer}>
            <button
              type="button"
              className={styles.timeInputButton}
              onClick={() =>
                setOpenTimePicker(openTimePicker === "checkOut" ? null : "checkOut")
              }
            >
              <span className={styles.timeDisplay}>
                {checkOutParsed.period === "AM" ? "오전" : "오후"} {String(checkOutParsed.hour).padStart(2, "0")}:{String(checkOutParsed.minute).padStart(2, "0")}
              </span>
              <TimeIcon />
            </button>
            {openTimePicker === "checkOut" && (
              <TimePicker
                hour={checkOutParsed.hour}
                minute={checkOutParsed.minute}
                period={checkOutParsed.period}
                onChange={(h, m, p) => onTimeChange("checkOut", h, m, p)}
                onClose={() => setOpenTimePicker(null)}
              />
            )}
          </div>
          <p className={styles.helperText}>게스트가 체크아웃해야 하는 시간입니다.</p>
        </div>
      </div>
    </div>
  );
};
