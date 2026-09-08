import { useState } from "react";
import {
  calendarNightsBetween,
  formatCalendarLocalDate,
} from "../../../../shared/lib/calendarLocalDate";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import { Button, DatePicker, Dialog } from "../../../../shared/ui";
import type { AccommodationBookingViewModel } from "../lib/accommodationBookingViewModel";
import styles from "./AccommodationMobileDateDialog.module.css";

interface AccommodationMobileDateDialogProps {
  checkIn: Date | null;
  checkOut: Date | null;
  availability: AccommodationBookingViewModel["availability"];
  disabled: boolean;
  ratingLabel?: string;
  onClose: () => void;
  onSave: (checkIn: Date, checkOut: Date) => void;
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

export function AccommodationMobileDateDialog({
  checkIn,
  checkOut,
  availability,
  disabled,
  ratingLabel,
  onClose,
  onSave,
}: AccommodationMobileDateDialogProps) {
  const [draftCheckIn, setDraftCheckIn] = useState(checkIn);
  const [draftCheckOut, setDraftCheckOut] = useState(checkOut);
  const start = draftCheckIn ? formatCalendarLocalDate(draftCheckIn) : null;
  const end = draftCheckOut ? formatCalendarLocalDate(draftCheckOut) : null;
  const nights = start && end ? (calendarNightsBetween(start, end) ?? 0) : 0;
  const canSave = Boolean(
    !disabled &&
    start &&
    end &&
    nights > 0 &&
    availability.selectionWindow &&
    start >= availability.selectionWindow.startInclusive &&
    end <= availability.selectionWindow.endExclusive &&
    !availability.disabledRanges.some(
      (range) => start < range.endExclusive && end > range.startInclusive,
    ),
  );
  const title = canSave
    ? `${nights}박`
    : draftCheckIn
      ? "체크아웃 날짜 선택"
      : "체크인 날짜 선택";

  return (
    <Dialog
      isOpen
      title="예약 날짜 선택"
      onClose={onClose}
      showHeader={false}
      size="custom"
      bodyPadding="none"
      className={requireCssModuleClass(styles.dialog)}
      bodyClassName={requireCssModuleClass(styles.body)}
    >
      <div className={styles.header}>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="날짜 선택 닫기"
          >
            <span aria-hidden="true">×</span>
          </button>
          <button
            type="button"
            className={styles.clearButton}
            disabled={disabled}
            onClick={() => {
              setDraftCheckIn(null);
              setDraftCheckOut(null);
            }}
          >
            날짜 지우기
          </button>
        </div>
        <h2>{title}</h2>
        <p>
          {draftCheckIn && draftCheckOut
            ? `${formatDate(draftCheckIn)} – ${formatDate(draftCheckOut)}`
            : "여행 날짜를 입력하여 정확한 요금을 확인하세요."}
        </p>
        <div className={styles.weekdays} aria-hidden="true">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
      </div>
      <div className={styles.months}>
        <fieldset
          disabled={disabled}
          className={styles.calendar}
          aria-label="여행 날짜"
        >
          <DatePicker
            variant="sheet"
            hideFooter
            checkIn={draftCheckIn}
            checkOut={draftCheckOut}
            onDateSelect={(nextCheckIn, nextCheckOut) => {
              setDraftCheckIn(nextCheckIn);
              setDraftCheckOut(nextCheckOut);
            }}
            onClose={onClose}
            disabledRanges={availability.disabledRanges}
            {...(availability.selectionWindow
              ? { selectionWindow: availability.selectionWindow }
              : {})}
          />
        </fieldset>
      </div>
      <div className={styles.footer}>
        <div>
          <strong>{canSave ? `${nights}박` : "날짜를 선택해 요금 확인"}</strong>
          {ratingLabel && <span>★ {ratingLabel}</span>}
        </div>
        <Button
          disabled={!canSave}
          onClick={() => {
            if (!canSave || !draftCheckIn || !draftCheckOut) return;
            onSave(draftCheckIn, draftCheckOut);
            onClose();
          }}
        >
          저장
        </Button>
      </div>
    </Dialog>
  );
}
