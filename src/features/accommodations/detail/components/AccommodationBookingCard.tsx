import React from "react";
import type { AccommodationBookingViewModel } from "../lib/accommodationBookingViewModel";
import type { AccommodationBookingCouponViewModel } from "../lib/accommodationBookingSectionsViewModel";
import {
  BookingCouponSection,
  BookingDateSection,
  BookingGuestSection,
  BookingPriceBreakdown,
  BookingPriceHeader,
  BookingReserveAction,
} from "./AccommodationBookingCardSections";
import styles from "./AccommodationBookingCard.module.css";

type NumberSetter = React.Dispatch<React.SetStateAction<number>>;
type BooleanSetter = React.Dispatch<React.SetStateAction<boolean>>;
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
  setIsDatePickerOpen: BooleanSetter;
  setIsGuestPickerOpen: BooleanSetter;
  setAdultCount: NumberSetter;
  setChildCount: NumberSetter;
  setInfantCount: NumberSetter;
  setPetCount: NumberSetter;
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
  setSelectedCouponId: (couponId: number | null) => void;
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
    availabilityStatus,
    isStayReady,
    selectionState,
  } = bookingState;
  const {
    formatDate,
    handleDateSelect,
    setAdultCount,
    setChildCount,
    setInfantCount,
    setIsDatePickerOpen,
    setIsGuestPickerOpen,
    setPetCount,
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
  const { setSelectedCouponId, handleIssueCoupon } = couponActions;
  const {
    basePrice,
    availability,
    guestLimits: { maxAdultsAndChildren, maxInfants, maxPets },
  } = bookingView;
  const isDatePickerAvailableOpen =
    availabilityStatus === "ready" && isDatePickerOpen;

  return (
    <div className={styles.bookingCard}>
      <BookingPriceHeader nights={nights} payablePrice={payablePrice} />

      <BookingDateSection
        checkIn={checkIn}
        checkOut={checkOut}
        datePickerRef={datePickerRef}
        dateSectionRef={dateSectionRef}
        formatDate={formatDate}
        handleDateSelect={handleDateSelect}
        isDatePickerOpen={isDatePickerAvailableOpen}
        setIsDatePickerOpen={setIsDatePickerOpen}
        setIsGuestPickerOpen={setIsGuestPickerOpen}
        availabilityStatus={availabilityStatus}
        disabledRanges={availability.disabledRanges}
        retryAvailability={retryAvailability}
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
        setAdultCount={setAdultCount}
        setChildCount={setChildCount}
        setInfantCount={setInfantCount}
        setIsGuestPickerOpen={setIsGuestPickerOpen}
        setPetCount={setPetCount}
      />

      {isAuthenticated && (
        <BookingCouponSection
          couponDiscount={couponDiscount}
          coupons={coupons}
          errorMessage={couponErrorMessage}
          handleIssueCoupon={handleIssueCoupon}
          isLoadingCoupons={isLoadingCoupons}
          selectedCoupon={selectedCoupon}
          setSelectedCouponId={setSelectedCouponId}
        />
      )}

      <BookingPriceBreakdown
        basePrice={basePrice}
        couponDiscount={couponDiscount}
        nights={nights}
        selectedCoupon={selectedCoupon}
        totalPrice={totalPrice}
      />

      <BookingReserveAction
        availabilityStatus={availabilityStatus}
        hasCompleteStay={Boolean(checkIn && checkOut && nights > 0)}
        isReservationLocked={isReservationLocked}
        isReserving={isReserving}
        isStayReady={isStayReady}
        onReserve={onReserve}
        selectionState={selectionState}
      />
    </div>
  );
}
