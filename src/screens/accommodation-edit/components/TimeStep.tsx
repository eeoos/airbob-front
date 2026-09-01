import React from "react";
import { parseListingEditorTime } from "../../../features/accommodations/listing-editor/public";
import { useNonModalOverlayRegistration } from "../../../shared/ui";
import type {
  AccommodationEditTimeField,
  AccommodationEditTimePicker,
  AccommodationEditTimeValueSelection,
} from "../editorViewContract";
import formStyles from "./EditForm.module.css";
import styles from "./TimeStep.module.css";
import { TimeIcon } from "./accommodationEditIcons";
import { TimePicker } from "./TimePicker";

interface TimeStepProps {
  checkInTime: string;
  checkOutTime: string;
  openTimePicker: AccommodationEditTimePicker;
  onTimePickerOpen: (picker: AccommodationEditTimeField) => void;
  onTimePickerClose: () => void;
  onTimeValueSelect: (
    type: AccommodationEditTimeField,
    selection: AccommodationEditTimeValueSelection,
  ) => void;
}

export const TimeStep: React.FC<TimeStepProps> = ({
  checkInTime,
  checkOutTime,
  openTimePicker,
  onTimePickerOpen,
  onTimePickerClose,
  onTimeValueSelect,
}) => {
  const checkInParsed = parseListingEditorTime(checkInTime);
  const checkOutParsed = parseListingEditorTime(checkOutTime);
  const checkInTriggerRef = React.useRef<HTMLButtonElement>(null);
  const checkOutTriggerRef = React.useRef<HTMLButtonElement>(null);
  const checkInPickerRef = React.useRef<HTMLDivElement>(null);
  const checkOutPickerRef = React.useRef<HTMLDivElement>(null);
  const checkInOverlay = useNonModalOverlayRegistration({
    enabled: openTimePicker === "checkIn",
    onClose: onTimePickerClose,
    overlayRef: checkInPickerRef,
    triggerRef: checkInTriggerRef,
  });
  const checkOutOverlay = useNonModalOverlayRegistration({
    enabled: openTimePicker === "checkOut",
    onClose: onTimePickerClose,
    overlayRef: checkOutPickerRef,
    triggerRef: checkOutTriggerRef,
  });

  return (
    <div className={formStyles.stepContent}>
      <h2 className={formStyles.stepTitle}>
        체크인/체크아웃 시간을 설정하세요
      </h2>
      <p className={formStyles.stepDescription}>
        게스트가 체크인하고 체크아웃할 수 있는 시간을 설정해주세요.
      </p>

      <div className={styles.formRow}>
        <div className={formStyles.formGroup}>
          <span className={formStyles.label}>
            체크인 시간 <span className={formStyles.required}>*</span>
          </span>
          <div className={styles.timeInputContainer}>
            <button
              ref={checkInTriggerRef}
              aria-controls="check-in-time-picker"
              aria-expanded={openTimePicker === "checkIn"}
              type="button"
              className={styles.timeInputButton}
              onClick={() => {
                if (openTimePicker === "checkIn") {
                  onTimePickerClose();
                  return;
                }
                onTimePickerOpen("checkIn");
              }}
            >
              <span className={styles.timeDisplay}>
                {checkInParsed.period === "AM" ? "오전" : "오후"}{" "}
                {String(checkInParsed.hour).padStart(2, "0")}:
                {String(checkInParsed.minute).padStart(2, "0")}
              </span>
              <TimeIcon />
            </button>
            {openTimePicker === "checkIn" && (
              <TimePicker
                hour={checkInParsed.hour}
                id="check-in-time-picker"
                onEscape={checkInOverlay.requestCloseOnEscape}
                minute={checkInParsed.minute}
                pickerRef={checkInPickerRef}
                period={checkInParsed.period}
                onSelect={(selection) =>
                  onTimeValueSelect("checkIn", selection)
                }
              />
            )}
          </div>
          <p className={formStyles.helperText}>
            게스트가 체크인할 수 있는 시간입니다.
          </p>
        </div>

        <div className={formStyles.formGroup}>
          <span className={formStyles.label}>
            체크아웃 시간 <span className={formStyles.required}>*</span>
          </span>
          <div className={styles.timeInputContainer}>
            <button
              ref={checkOutTriggerRef}
              aria-controls="check-out-time-picker"
              aria-expanded={openTimePicker === "checkOut"}
              type="button"
              className={styles.timeInputButton}
              onClick={() => {
                if (openTimePicker === "checkOut") {
                  onTimePickerClose();
                  return;
                }
                onTimePickerOpen("checkOut");
              }}
            >
              <span className={styles.timeDisplay}>
                {checkOutParsed.period === "AM" ? "오전" : "오후"}{" "}
                {String(checkOutParsed.hour).padStart(2, "0")}:
                {String(checkOutParsed.minute).padStart(2, "0")}
              </span>
              <TimeIcon />
            </button>
            {openTimePicker === "checkOut" && (
              <TimePicker
                hour={checkOutParsed.hour}
                id="check-out-time-picker"
                onEscape={checkOutOverlay.requestCloseOnEscape}
                minute={checkOutParsed.minute}
                pickerRef={checkOutPickerRef}
                period={checkOutParsed.period}
                onSelect={(selection) =>
                  onTimeValueSelect("checkOut", selection)
                }
              />
            )}
          </div>
          <p className={formStyles.helperText}>
            게스트가 체크아웃해야 하는 시간입니다.
          </p>
        </div>
      </div>
    </div>
  );
};
