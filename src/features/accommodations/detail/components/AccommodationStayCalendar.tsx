import type { ReactNode, RefObject } from "react";
import { useResponsiveLayout } from "../../../../shared/styles/useResponsiveLayout";
import { DatePicker } from "../../../../shared/ui";
import type { AccommodationBookingViewModel } from "../lib/accommodationBookingViewModel";
import styles from "./AccommodationStayCalendar.module.css";

interface Props {
  bookingView: Pick<AccommodationBookingViewModel, "availability">;
  bookingState: {
    checkIn: Date | null;
    checkOut: Date | null;
    nights: number;
    quoteSnapshot: { readonly nights: number } | null;
    availabilityStatus: "loading" | "error" | "ready";
    selectionLocked: boolean;
  };
  bookingActions: {
    formatDate: (date: Date | null) => string;
    handleDateSelect: (checkIn: Date | null, checkOut: Date | null) => void;
    retryAvailability: () => void;
  };
  locationLabel?: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  children?: ReactNode;
}

export function AccommodationStayCalendar({
  bookingView,
  bookingState,
  bookingActions,
  locationLabel,
  headingRef,
  children,
}: Props) {
  const isMobile = useResponsiveLayout() === "mobile-tablet";
  const {
    checkIn,
    checkOut,
    nights,
    quoteSnapshot,
    availabilityStatus,
    selectionLocked,
  } = bookingState;
  const { formatDate, handleDateSelect, retryAvailability } = bookingActions;
  const displayedNights = quoteSnapshot?.nights ?? nights;
  const hasCompleteStay = Boolean(checkIn && checkOut && displayedNights > 0);
  const { availability } = bookingView;

  return (
    <section className={styles.section} aria-label="숙박 날짜">
      <h2 ref={headingRef} tabIndex={-1} className={styles.heading}>
        {hasCompleteStay
          ? `${locationLabel ? `${locationLabel}에서 ` : ""}${displayedNights}박`
          : checkIn
            ? "체크아웃 날짜 선택"
            : "체크인 날짜 선택"}
      </h2>
      <p className={styles.summary}>
        {checkIn
          ? `${formatDate(checkIn)}${checkOut ? ` – ${formatDate(checkOut)}` : " · 체크아웃 날짜를 선택해주세요"}`
          : "여행 날짜를 선택하면 요금을 확인할 수 있어요."}
      </p>
      {availabilityStatus === "ready" ? (
        <fieldset
          disabled={selectionLocked}
          className={styles.calendar}
          aria-label="숙박 날짜 선택"
        >
          <DatePicker
            checkIn={checkIn}
            checkOut={checkOut}
            onDateSelect={handleDateSelect}
            onClose={() => undefined}
            disabledRanges={availability.disabledRanges}
            {...(availability.selectionWindow
              ? { selectionWindow: availability.selectionWindow }
              : {})}
            variant="inline"
            numberOfMonths={isMobile ? 1 : 2}
          />
        </fieldset>
      ) : (
        <div className={styles.status} role="status">
          {availabilityStatus === "loading"
            ? "예약 가능한 날짜를 확인하고 있어요."
            : "날짜 정보를 불러오지 못했어요."}
          {availabilityStatus === "error" && (
            <button
              type="button"
              className={styles.retry}
              onClick={retryAvailability}
            >
              다시 불러오기
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
