import type { ComponentProps } from "react";
import type { AccommodationBookingCard } from "./AccommodationBookingCard";
import { BookingReserveAction } from "./AccommodationBookingCardSections";
import styles from "./AccommodationBookingSummary.module.css";

type Props = Pick<
  ComponentProps<typeof AccommodationBookingCard>,
  "bookingState" | "bookingActions"
> & {
  ratingLabel?: string | undefined;
  reviewCountLabel?: string | undefined;
  onRevealBooking: () => void;
};

export function AccommodationBookingSummary({
  bookingState,
  bookingActions,
  ratingLabel,
  reviewCountLabel,
  onRevealBooking,
}: Props) {
  const { checkIn, checkOut, nights, payablePrice, quoteSnapshot } =
    bookingState;
  const hasCompleteStay = Boolean(
    checkIn && checkOut && (quoteSnapshot?.nights ?? nights) > 0,
  );

  return (
    <div className={styles.summary} aria-label="예약 요약">
      <div className={styles.price}>
        {hasCompleteStay ? (
          <span>
            총액{" "}
            <strong>
              ₩{(quoteSnapshot?.amount ?? payablePrice).toLocaleString()}
            </strong>
          </span>
        ) : (
          <strong>날짜를 선택해 요금 확인</strong>
        )}
        {ratingLabel && (
          <span className={styles.rating}>
            ★ {ratingLabel}
            {reviewCountLabel ? ` · ${reviewCountLabel}` : ""}
          </span>
        )}
      </div>
      <div className={styles.action}>
        <BookingReserveAction
          {...bookingState}
          hasCompleteStay={hasCompleteStay}
          onReserve={() => {
            onRevealBooking();
            bookingActions.onReserve();
          }}
          onRequestDates={() => {
            onRevealBooking();
            bookingActions.onGuestPickerOpenChange(false);
            bookingActions.onDatePickerOpenChange(true);
          }}
          retryAvailability={bookingActions.retryAvailability}
        />
      </div>
    </div>
  );
}
