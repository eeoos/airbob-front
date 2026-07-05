import React from "react";
import { AccommodationDetail } from "../../../types/accommodation";
import { CouponInfo } from "../../../types/coupon";
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

interface AccommodationBookingCardProps {
  accommodation: AccommodationDetail;
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
  coupons: CouponInfo[];
  isLoadingCoupons: boolean;
  selectedCoupon: CouponInfo | null;
  selectedCouponId: number | null;
  setSelectedCouponId: (couponId: number | null) => void;
  issuingCouponId: number | null;
  couponDiscount: number;
  handleIssueCoupon: (coupon: CouponInfo) => void | Promise<void>;
  isReserving: boolean;
  onReserve: () => void;
}


export function AccommodationBookingCard({
  accommodation,
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
  const maxOccupancy = accommodation.policy.max_occupancy;
  const maxInfants = accommodation.policy.infant_occupancy;
  const maxPets = accommodation.policy.pet_occupancy;

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
        unavailableDates={accommodation.unavailable_dates}
      />

      <BookingGuestSection
        adultCount={adultCount}
        childCount={childCount}
        guestPickerRef={guestPickerRef}
        infantCount={infantCount}
        isDatePickerOpen={isDatePickerOpen}
        isGuestPickerOpen={isGuestPickerOpen}
        maxInfants={maxInfants}
        maxOccupancy={maxOccupancy}
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
        basePrice={accommodation.base_price}
        couponDiscount={couponDiscount}
        nights={nights}
        selectedCoupon={selectedCoupon}
        totalPrice={totalPrice}
      />

      <BookingReserveAction isReserving={isReserving} onReserve={onReserve} />
    </div>
  );
}
