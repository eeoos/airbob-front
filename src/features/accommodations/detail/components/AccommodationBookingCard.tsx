import React from "react";
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
  onSelectedCouponIdChange: (couponId: number | null) => void;
  handleIssueCoupon: (coupon: BookingCoupon) => void | Promise<void>;
}

interface AccommodationBookingCardProps {
  bookingView: AccommodationBookingViewModel;
  isAuthenticated: boolean;
  bookingState: AccommodationBookingState;
  bookingActions: AccommodationBookingActions;
  couponState: AccommodationCouponState;
  couponActions: AccommodationCouponActions;
}

export function AccommodationBookingCard({
  bookingView,
  isAuthenticated,
  bookingState,
  bookingActions,
  couponState,
  couponActions,
}: AccommodationBookingCardProps) {
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
  const { onSelectedCouponIdChange, handleIssueCoupon } = couponActions;
  const {
    basePrice,
    availability,
    guestLimits: { maxAdultsAndChildren, maxInfants, maxPets },
  } = bookingView;
  const isDatePickerAvailableOpen =
    availabilityStatus === "ready" && isDatePickerOpen;

  return (
    <div className={styles.bookingCard}>
      <BookingPriceHeader
        nights={quoteSnapshot?.nights ?? nights}
        payablePrice={quoteSnapshot?.amount ?? payablePrice}
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
        retryAvailability={retryAvailability}
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
        onGuestPickerOpenChange={onGuestPickerOpenChange}
        onPetCountChange={onPetCountChange}
        selectionLocked={selectionLocked}
      />

      {isAuthenticated && (
        <BookingCouponSection
          couponDiscount={couponDiscount}
          coupons={coupons}
          errorMessage={couponErrorMessage}
          handleIssueCoupon={handleIssueCoupon}
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
      )}

      <BookingReserveAction
        availabilityStatus={availabilityStatus}
        hasCompleteStay={Boolean(checkIn && checkOut && nights > 0)}
        isReservationLocked={isReservationLocked}
        isReserving={isReserving}
        isStayReady={isStayReady}
        onReserve={onReserve}
        reservationStatus={reservationStatus}
        selectionState={selectionState}
      />
    </div>
  );
}
