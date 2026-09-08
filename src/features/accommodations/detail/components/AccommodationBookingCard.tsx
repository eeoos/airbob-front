import React from "react";
import { DatePicker } from "../../../../shared/ui";
import { useResponsiveLayout } from "../../../../shared/styles/useResponsiveLayout";
import type { AccommodationBookingViewModel } from "../lib/accommodationBookingViewModel";
import type { AccommodationBookingCouponViewModel } from "../lib/accommodationBookingSectionsViewModel";
import {
  BookingCouponSection,
  BookingDateSection,
  BookingGuestSection,
  BookingPriceBreakdown,
  BookingPriceHeader,
  BookingQuoteSummary,
  BookingReserveAction,
} from "./AccommodationBookingCardSections";
import styles from "./AccommodationBookingCard.module.css";
import { AccommodationMobileDateDialog } from "./AccommodationMobileDateDialog";

type BookingCoupon = AccommodationBookingCouponViewModel;

interface AccommodationBookingState {
  availabilityStatus: "loading" | "error" | "ready";
  isStayReady: boolean;
  payablePrice: number;
  nights: number;
  totalPrice: number;
  checkIn: Date | null;
  checkOut: Date | null;
  dateSectionRef: React.RefObject<HTMLDivElement | null>;
  datePickerRef: React.RefObject<HTMLDivElement | null>;
  guestPickerRef: React.RefObject<HTMLDivElement | null>;
  isDatePickerOpen: boolean;
  isGuestPickerOpen: boolean;
  adultCount: number;
  childCount: number;
  infantCount: number;
  petCount: number;
  isReservationLocked: boolean;
  isReserving: boolean;
  quoteSnapshot: {
    readonly amount: number;
    readonly canCheckout: boolean;
    readonly currency: string;
    readonly discountAmount: number;
    readonly nightlyPrice: number;
    readonly nights: number;
    readonly phase: string;
    readonly quoteExpiresAt: string;
    readonly subtotal: number;
  } | null;
  reservationStatus:
    | "idle"
    | "quoting"
    | "quoted"
    | "checking-out"
    | "terminal-ready"
    | "completing"
    | "locked";
  selectionLocked: boolean;
  selectionState:
    | "availability-unavailable"
    | "fully-booked"
    | "incomplete"
    | "invalid"
    | "outside-window"
    | "ready"
    | "unavailable";
}

interface AccommodationBookingActions {
  formatDate: (date: Date | null) => string;
  handleDateSelect: (checkIn: Date | null, checkOut: Date | null) => void;
  onDatePickerOpenChange: (isOpen: boolean) => void;
  onGuestPickerOpenChange: (isOpen: boolean) => void;
  onAdultCountChange: (count: number) => void;
  onChildCountChange: (count: number) => void;
  onInfantCountChange: (count: number) => void;
  onPetCountChange: (count: number) => void;
  onAbandonQuote: () => boolean;
  onReserve: () => void;
  retryAvailability: () => void;
}

interface AccommodationCouponState {
  coupons: BookingCoupon[];
  errorMessage: string | null;
  isLoadingCoupons: boolean;
  selectedCoupon: BookingCoupon | null;
  couponDiscount: number;
}

interface AccommodationCouponActions {
  retryCoupons: () => void;
  onSelectedCouponIdChange: (couponId: number | null) => void;
  handleIssueCoupon: (coupon: BookingCoupon) => void | Promise<void>;
}

interface AccommodationBookingCardProps {
  locationLabel?: string;
  ratingLabel?: string;
  bookingView: AccommodationBookingViewModel;
  isAuthenticated: boolean;
  bookingState: AccommodationBookingState;
  bookingActions: AccommodationBookingActions;
  couponState: AccommodationCouponState;
  couponActions: AccommodationCouponActions;
}

export function AccommodationBookingCard({
  locationLabel,
  ratingLabel,
  bookingView,
  isAuthenticated,
  bookingState,
  bookingActions,
  couponState,
  couponActions,
}: AccommodationBookingCardProps) {
  const isMobile = useResponsiveLayout() === "mobile-tablet";
  const [isMobileDatesOpen, setIsMobileDatesOpen] = React.useState(false);
  const calendarHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const quoteSummaryRef = React.useRef<HTMLDivElement>(null);
  const {
    payablePrice,
    nights,
    totalPrice,
    checkIn,
    checkOut,
    dateSectionRef,
    datePickerRef,
    guestPickerRef,
    isDatePickerOpen,
    isGuestPickerOpen,
    adultCount,
    childCount,
    infantCount,
    petCount,
    isReservationLocked,
    isReserving,
    quoteSnapshot,
    reservationStatus,
    selectionLocked,
    availabilityStatus,
    isStayReady,
    selectionState,
  } = bookingState;
  const {
    formatDate,
    handleDateSelect,
    onAdultCountChange,
    onChildCountChange,
    onDatePickerOpenChange,
    onGuestPickerOpenChange,
    onInfantCountChange,
    onPetCountChange,
    onAbandonQuote,
    onReserve,
    retryAvailability,
  } = bookingActions;
  const {
    coupons,
    errorMessage: couponErrorMessage,
    isLoadingCoupons,
    selectedCoupon,
    couponDiscount,
  } = couponState;
  const { onSelectedCouponIdChange, handleIssueCoupon, retryCoupons } =
    couponActions;
  const {
    basePrice,
    availability,
    guestLimits: { maxAdultsAndChildren, maxInfants, maxPets },
  } = bookingView;
  const isDatePickerAvailableOpen =
    availabilityStatus === "ready" && isDatePickerOpen;
  const displayedNights = quoteSnapshot?.nights ?? nights;
  const hasCompleteStay = Boolean(checkIn && checkOut && displayedNights > 0);

  const requestDates = () => {
    onGuestPickerOpenChange(false);
    onDatePickerOpenChange(true);
  };
  const requestMobileDates = () => {
    calendarHeadingRef.current?.scrollIntoView({ block: "start" });
    calendarHeadingRef.current?.focus({ preventScroll: true });
  };

  const hasQuote = quoteSnapshot !== null;
  React.useEffect(() => {
    if (!isMobile || !hasQuote) return;
    quoteSummaryRef.current?.scrollIntoView({ block: "center" });
    quoteSummaryRef.current?.focus({ preventScroll: true });
  }, [hasQuote, isMobile]);
  const renderReserveAction = (
    reserve: () => void,
    selectDates: () => void,
  ) => (
    <BookingReserveAction
      availabilityStatus={availabilityStatus}
      hasCompleteStay={hasCompleteStay}
      isReservationLocked={isReservationLocked}
      isReserving={isReserving}
      isStayReady={isStayReady}
      onReserve={reserve}
      onRequestDates={selectDates}
      reservationStatus={reservationStatus}
      retryAvailability={retryAvailability}
      selectionState={selectionState}
    />
  );

  const priceDetails = (
    <>
      {isAuthenticated && hasCompleteStay && (
        <BookingCouponSection
          couponDiscount={couponDiscount}
          coupons={coupons}
          errorMessage={couponErrorMessage}
          handleIssueCoupon={handleIssueCoupon}
          onRetry={retryCoupons}
          isLoadingCoupons={isLoadingCoupons}
          selectedCoupon={selectedCoupon}
          onSelectedCouponIdChange={onSelectedCouponIdChange}
          selectionLocked={selectionLocked}
        />
      )}

      <BookingPriceBreakdown
        basePrice={basePrice}
        couponDiscount={couponDiscount}
        nights={nights}
        selectedCoupon={selectedCoupon}
        totalPrice={totalPrice}
      />

      {quoteSnapshot && (
        <div
          ref={quoteSummaryRef}
          tabIndex={-1}
          className={styles.quoteFocusTarget}
        >
          <BookingQuoteSummary
            amount={quoteSnapshot.amount}
            canAbandon={
              quoteSnapshot.phase === "quoted" ||
              quoteSnapshot.phase === "checkout-prepared"
            }
            currency={quoteSnapshot.currency}
            discountAmount={quoteSnapshot.discountAmount}
            onAbandonQuote={onAbandonQuote}
            quoteExpiresAt={quoteSnapshot.quoteExpiresAt}
            subtotal={quoteSnapshot.subtotal}
          />
        </div>
      )}
    </>
  );

  const bookingContent = (
    <section aria-label="숙소 예약" className={styles.bookingCard}>
      <BookingPriceHeader
        hasCompleteStay={hasCompleteStay}
        payablePrice={quoteSnapshot?.amount ?? payablePrice}
        totalPrice={quoteSnapshot?.subtotal ?? totalPrice}
      />

      <BookingDateSection
        checkIn={checkIn}
        checkOut={checkOut}
        datePickerRef={datePickerRef}
        dateSectionRef={dateSectionRef}
        formatDate={formatDate}
        handleDateSelect={handleDateSelect}
        isDatePickerOpen={isDatePickerAvailableOpen}
        onDatePickerOpenChange={onDatePickerOpenChange}
        onGuestPickerOpenChange={onGuestPickerOpenChange}
        availabilityStatus={availabilityStatus}
        disabledRanges={availability.disabledRanges}
        nights={displayedNights}
        selectionLocked={selectionLocked}
        selectionWindow={availability.selectionWindow}
      />

      <BookingGuestSection
        adultCount={adultCount}
        childCount={childCount}
        guestPickerRef={guestPickerRef}
        infantCount={infantCount}
        isDatePickerOpen={isDatePickerAvailableOpen}
        isGuestPickerOpen={isGuestPickerOpen}
        maxInfants={maxInfants}
        maxOccupancy={maxAdultsAndChildren}
        maxPets={maxPets}
        petCount={petCount}
        onAdultCountChange={onAdultCountChange}
        onChildCountChange={onChildCountChange}
        onInfantCountChange={onInfantCountChange}
        onDatePickerOpenChange={onDatePickerOpenChange}
        onGuestPickerOpenChange={onGuestPickerOpenChange}
        onPetCountChange={onPetCountChange}
        selectionLocked={selectionLocked}
      />

      {priceDetails}

      {renderReserveAction(onReserve, requestDates)}
    </section>
  );

  if (!isMobile) return bookingContent;

  return (
    <>
      <section className={styles.mobileCalendarSection} aria-label="숙박 날짜">
        <h2
          ref={calendarHeadingRef}
          tabIndex={-1}
          className={styles.mobileCalendarHeading}
        >
          {hasCompleteStay
            ? `${locationLabel ? `${locationLabel}에서 ` : ""}${displayedNights}박`
            : checkIn
              ? "체크아웃 날짜 선택"
              : "체크인 날짜 선택"}
        </h2>
        <p className={styles.mobileCalendarSummary}>
          {checkIn
            ? `${formatDate(checkIn)}${checkOut ? ` – ${formatDate(checkOut)}` : " · 체크아웃 날짜를 선택해주세요"}`
            : "여행 날짜를 선택하면 요금을 확인할 수 있어요."}
        </p>
        {availabilityStatus === "ready" ? (
          <fieldset
            disabled={selectionLocked}
            className={styles.mobileCalendar}
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
            />
          </fieldset>
        ) : (
          <div className={styles.mobileCalendarStatus} role="status">
            {availabilityStatus === "loading"
              ? "예약 가능한 날짜를 확인하고 있어요."
              : "날짜 정보를 불러오지 못했어요."}
            {availabilityStatus === "error" && (
              <button
                type="button"
                className={styles.quoteResetButton}
                onClick={retryAvailability}
              >
                다시 불러오기
              </button>
            )}
          </div>
        )}
        {priceDetails}
      </section>
      <div className={styles.mobileBookingBar} aria-label="예약 요약">
        <button
          className={styles.mobileSummaryButton}
          type="button"
          aria-label="숙박 날짜 변경"
          onClick={
            hasCompleteStay
              ? requestMobileDates
              : () => setIsMobileDatesOpen(true)
          }
        >
          {hasCompleteStay ? (
            <>
              <span>
                총액{" "}
                <strong>
                  ₩{(quoteSnapshot?.amount ?? payablePrice).toLocaleString()}
                </strong>
              </span>
              <span className={styles.mobileStaySummary}>
                {formatDate(checkIn)} – {formatDate(checkOut)}
              </span>
            </>
          ) : (
            <strong>
              날짜를 선택해
              <br />
              요금 확인
            </strong>
          )}
          {hasCompleteStay ? (
            <span className={styles.mobileStaySummary}>
              게스트 {adultCount + childCount}명
              {infantCount > 0 ? ` · 유아 ${infantCount}명` : ""}
              {petCount > 0 ? ` · 반려동물 ${petCount}마리` : ""}
            </span>
          ) : ratingLabel ? (
            <span className={styles.mobileRating}>★ {ratingLabel}</span>
          ) : null}
        </button>
        <div className={styles.mobileReserveAction}>
          {renderReserveAction(onReserve, () => setIsMobileDatesOpen(true))}
        </div>
      </div>
      {isMobileDatesOpen && (
        <AccommodationMobileDateDialog
          checkIn={checkIn}
          checkOut={checkOut}
          availability={availability}
          disabled={selectionLocked || availabilityStatus !== "ready"}
          {...(ratingLabel ? { ratingLabel } : {})}
          onSave={handleDateSelect}
          onClose={() => setIsMobileDatesOpen(false)}
        />
      )}
    </>
  );
}
