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

interface AccommodationBookingCardProps {
  bookingView: AccommodationBookingViewModel;
  isAuthenticated: boolean;
  payablePrice: number;
  nights: number;
  totalPrice: number;
  checkIn: Date | null;
  checkOut: Date | null;
  formatDate: (date: Date | null) => string;
  handleDateSelect: (checkIn: Date | null, checkOut: Date | null) => void;
  dateSectionRef: React.RefObject<HTMLDivElement | null>;
  datePickerRef: React.RefObject<HTMLDivElement | null>;
  guestPickerRef: React.RefObject<HTMLDivElement | null>;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: BooleanSetter;
  isGuestPickerOpen: boolean;
  setIsGuestPickerOpen: BooleanSetter;
  adultCount: number;
  setAdultCount: NumberSetter;
  childCount: number;
  setChildCount: NumberSetter;
  infantCount: number;
  setInfantCount: NumberSetter;
  petCount: number;
  setPetCount: NumberSetter;
  coupons: BookingCoupon[];
  isLoadingCoupons: boolean;
  selectedCoupon: BookingCoupon | null;
  selectedCouponId: number | null;
  setSelectedCouponId: (couponId: number | null) => void;
  issuingCouponId: number | null;
  couponDiscount: number;
  handleIssueCoupon: (coupon: BookingCoupon) => void | Promise<void>;
  isReserving: boolean;
  onReserve: () => void;
}


export function AccommodationBookingCard({
  bookingView,
  isAuthenticated,
  payablePrice,
  nights,
  totalPrice,
  checkIn,
  checkOut,
  formatDate,
  handleDateSelect,
  dateSectionRef,
  datePickerRef,
  guestPickerRef,
  isDatePickerOpen,
  setIsDatePickerOpen,
  isGuestPickerOpen,
  setIsGuestPickerOpen,
  adultCount,
  setAdultCount,
  childCount,
  setChildCount,
  infantCount,
  setInfantCount,
  petCount,
  setPetCount,
  coupons,
  isLoadingCoupons,
  selectedCoupon,
  selectedCouponId,
  setSelectedCouponId,
  issuingCouponId,
  couponDiscount,
  handleIssueCoupon,
  isReserving,
  onReserve,
}: AccommodationBookingCardProps) {
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
