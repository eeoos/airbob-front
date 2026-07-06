import React from "react";
import type { AccommodationBookingViewModel } from "../lib/accommodationBookingViewModel";
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
type BookingCoupon =
  React.ComponentProps<typeof BookingCouponSection>["coupons"][number];

export interface AccommodationBookingState {
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
  isReserving: boolean;
}

export interface AccommodationBookingActions {
  formatDate: (date: Date | null) => string;
  handleDateSelect: (checkIn: Date | null, checkOut: Date | null) => void;
  setIsDatePickerOpen: BooleanSetter;
  setIsGuestPickerOpen: BooleanSetter;
  setAdultCount: NumberSetter;
  setChildCount: NumberSetter;
  setInfantCount: NumberSetter;
  setPetCount: NumberSetter;
  onReserve: () => void;
}

export interface AccommodationCouponState {
  coupons: BookingCoupon[];
  isLoadingCoupons: boolean;
  selectedCoupon: BookingCoupon | null;
  selectedCouponId: number | null;
  issuingCouponId: number | null;
  couponDiscount: number;
}

export interface AccommodationCouponActions {
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
    isReserving,
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
  } = bookingActions;
  const {
    coupons,
    isLoadingCoupons,
    selectedCoupon,
    selectedCouponId,
    issuingCouponId,
    couponDiscount,
  } = couponState;
  const { setSelectedCouponId, handleIssueCoupon } = couponActions;
  const {
    basePrice,
    unavailableDates,
    guestLimits: { maxAdultsAndChildren, maxInfants, maxPets },
  } = bookingView;

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
        isDatePickerOpen={isDatePickerOpen}
        setIsDatePickerOpen={setIsDatePickerOpen}
        unavailableDates={unavailableDates}
      />

      <BookingGuestSection
        adultCount={adultCount}
        childCount={childCount}
        guestPickerRef={guestPickerRef}
        infantCount={infantCount}
        isDatePickerOpen={isDatePickerOpen}
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
          handleIssueCoupon={handleIssueCoupon}
          isLoadingCoupons={isLoadingCoupons}
          issuingCouponId={issuingCouponId}
          selectedCoupon={selectedCoupon}
          selectedCouponId={selectedCouponId}
          setSelectedCouponId={setSelectedCouponId}
          totalPrice={totalPrice}
        />
      )}

      <BookingPriceBreakdown
        basePrice={basePrice}
        couponDiscount={couponDiscount}
        nights={nights}
        selectedCoupon={selectedCoupon}
        totalPrice={totalPrice}
      />

      <BookingReserveAction isReserving={isReserving} onReserve={onReserve} />
    </div>
  );
}
