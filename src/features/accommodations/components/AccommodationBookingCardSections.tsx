import React from "react";
import DatePicker from "../../../components/DatePicker/DatePicker";
import { CouponInfo } from "../../../types/coupon";
import {
  calculateCouponDiscount,
  formatCouponDiscount,
} from "../../../utils/codes";
import { Button, CounterStepper } from "../../../shared/ui";
import styles from "./AccommodationBookingCard.module.css";

type NumberSetter = React.Dispatch<React.SetStateAction<number>>;
type BooleanSetter = React.Dispatch<React.SetStateAction<boolean>>;

interface BookingPriceHeaderProps {
  nights: number;
  payablePrice: number;
}

interface BookingDateSectionProps {
  checkIn: Date | null;
  checkOut: Date | null;
  datePickerRef: React.RefObject<HTMLDivElement | null>;
  dateSectionRef: React.RefObject<HTMLDivElement | null>;
  formatDate: (date: Date | null) => string;
  handleDateSelect: (checkIn: Date | null, checkOut: Date | null) => void;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: BooleanSetter;
  unavailableDates: Array<string | Date>;
}

interface BookingGuestSectionProps {
  adultCount: number;
  childCount: number;
  guestPickerRef: React.RefObject<HTMLDivElement | null>;
  infantCount: number;
  isDatePickerOpen: boolean;
  isGuestPickerOpen: boolean;
  maxInfants: number;
  maxOccupancy: number;
  maxPets: number;
  petCount: number;
  setAdultCount: NumberSetter;
  setChildCount: NumberSetter;
  setInfantCount: NumberSetter;
  setIsGuestPickerOpen: BooleanSetter;
  setPetCount: NumberSetter;
}

interface BookingCouponSectionProps {
  couponDiscount: number;
  coupons: CouponInfo[];
  handleIssueCoupon: (coupon: CouponInfo) => void | Promise<void>;
  isLoadingCoupons: boolean;
  issuingCouponId: number | null;
  selectedCoupon: CouponInfo | null;
  selectedCouponId: number | null;
  setSelectedCouponId: (couponId: number | null) => void;
  totalPrice: number;
}

interface BookingPriceBreakdownProps {
  basePrice: number;
  couponDiscount: number;
  nights: number;
  selectedCoupon: CouponInfo | null;
  totalPrice: number;
}

interface BookingReserveActionProps {
  isReserving: boolean;
  onReserve: () => void;
}

interface GuestCounterRowProps {
  decrementLabel: string;
  incrementLabel: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  subtitle: React.ReactNode;
  title: string;
  value: number;
}

const toUnavailableDate = (date: string | Date) => {
  if (typeof date === "string") {
    return date;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildGuestSummary = ({
  adultCount,
  childCount,
  infantCount,
  petCount,
}: Pick<
  BookingGuestSectionProps,
  "adultCount" | "childCount" | "infantCount" | "petCount"
>) => {
  const guestCount = adultCount + childCount;
  const parts: string[] = [];

  if (guestCount > 0) {
    parts.push(`게스트 ${guestCount}명`);
  }
  if (infantCount > 0) {
    parts.push(`유아 ${infantCount}명`);
  }
  if (petCount > 0) {
    parts.push(`반려동물 ${petCount}마리`);
  }

  return parts.length > 0 ? parts.join(", ") : "게스트 1명";
};

const getCouponActionLabel = ({
  isApplicable,
  isIssuing,
  isSelected,
}: {
  isApplicable: boolean;
  isIssuing: boolean;
  isSelected: boolean;
}) => {
  if (isSelected) {
    return "적용 중";
  }
  if (isIssuing) {
    return "발급 중";
  }
  if (isApplicable) {
    return "발급/적용";
  }
  return "조건 미달";
};

function GuestCounterRow({
  decrementLabel,
  incrementLabel,
  max,
  min = 0,
  onChange,
  subtitle,
  title,
  value,
}: GuestCounterRowProps) {
  return (
    <div className={styles.guestPickerItem}>
      <div className={styles.guestPickerLabel}>
        <div className={styles.guestPickerTitle}>{title}</div>
        <div className={styles.guestPickerSubtitle}>{subtitle}</div>
      </div>
      <CounterStepper
        decrementLabel={decrementLabel}
        incrementLabel={incrementLabel}
        min={min}
        max={max}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export function BookingPriceHeader({
  nights,
  payablePrice,
}: BookingPriceHeaderProps) {
  return (
    <div className={styles.priceSection}>
      <span className={styles.totalPrice}>₩{payablePrice.toLocaleString()}</span>
      <span className={styles.priceInfo}>· {nights}박</span>
    </div>
  );
}

export function BookingDateSection({
  checkIn,
  checkOut,
  datePickerRef,
  dateSectionRef,
  formatDate,
  handleDateSelect,
  isDatePickerOpen,
  setIsDatePickerOpen,
  unavailableDates,
}: BookingDateSectionProps) {
  return (
    <div className={styles.dateSection} ref={dateSectionRef}>
      <button
        type="button"
        className={styles.dateRow}
        aria-expanded={isDatePickerOpen}
        aria-controls="booking-date-picker"
        onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
      >
        <div className={styles.dateColumn}>
          <div className={styles.dateLabel}>체크인</div>
          <div className={styles.dateValue}>{formatDate(checkIn)}</div>
        </div>
        <div className={styles.dateDivider} />
        <div className={styles.dateColumn}>
          <div className={styles.dateLabel}>체크아웃</div>
          <div className={styles.dateValue}>{formatDate(checkOut)}</div>
        </div>
      </button>
      <div className={styles.horizontalDivider} />

      {isDatePickerOpen && (
        <div id="booking-date-picker" className={styles.datePickerContainer}>
          <DatePicker
            checkIn={checkIn}
            checkOut={checkOut}
            onDateSelect={handleDateSelect}
            onClose={() => setIsDatePickerOpen(false)}
            datePickerRef={datePickerRef}
            unavailableDates={unavailableDates.map(toUnavailableDate)}
          />
        </div>
      )}
    </div>
  );
}

export function BookingGuestSection({
  adultCount,
  childCount,
  guestPickerRef,
  infantCount,
  isDatePickerOpen,
  isGuestPickerOpen,
  maxInfants,
  maxOccupancy,
  maxPets,
  petCount,
  setAdultCount,
  setChildCount,
  setInfantCount,
  setIsGuestPickerOpen,
  setPetCount,
}: BookingGuestSectionProps) {
  const guestCount = adultCount + childCount;

  return (
    <div
      className={`${styles.guestRowContainer} ${
        isDatePickerOpen ? styles.hidden : ""
      }`}
      ref={guestPickerRef}
    >
      <button
        type="button"
        className={styles.guestRow}
        aria-expanded={isGuestPickerOpen}
        aria-controls="booking-guest-picker"
        onClick={() => setIsGuestPickerOpen(!isGuestPickerOpen)}
      >
        <div className={styles.guestColumn}>
          <div className={styles.dateLabel}>인원</div>
          <div className={styles.guestValue}>
            {buildGuestSummary({
              adultCount,
              childCount,
              infantCount,
              petCount,
            })}
          </div>
        </div>
        <div className={styles.guestArrow}>
          {isGuestPickerOpen ? "⌃" : "⌄"}
        </div>
      </button>

      {isGuestPickerOpen && (
        <div id="booking-guest-picker" className={styles.guestPicker}>
          <GuestCounterRow
            title="성인"
            subtitle="13세 이상"
            value={adultCount}
            decrementLabel="성인 줄이기"
            incrementLabel="성인 늘리기"
            min={1}
            max={adultCount + (maxOccupancy - guestCount)}
            onChange={setAdultCount}
          />

          <GuestCounterRow
            title="어린이"
            subtitle="2~12세"
            value={childCount}
            decrementLabel="어린이 줄이기"
            incrementLabel="어린이 늘리기"
            max={childCount + (maxOccupancy - guestCount)}
            onChange={setChildCount}
          />

          <GuestCounterRow
            title="유아"
            subtitle="2세 미만"
            value={infantCount}
            decrementLabel="유아 줄이기"
            incrementLabel="유아 늘리기"
            max={maxInfants}
            onChange={setInfantCount}
          />

          <GuestCounterRow
            title="반려동물"
            subtitle={
              maxPets === 0 ? (
                <span className={styles.guestPickerLink}>
                  보조동물을 동반하시나요?
                </span>
              ) : (
                "반려동물"
              )
            }
            value={petCount}
            decrementLabel="반려동물 줄이기"
            incrementLabel="반려동물 늘리기"
            max={maxPets}
            onChange={setPetCount}
          />

          <div className={styles.guestPickerNote}>
            이 숙소의 최대 숙박 인원은 {maxOccupancy}명(유아 제외)입니다.{" "}
            {maxPets === 0 && "반려동물 동반은 허용되지 않습니다."}
          </div>

          <Button
            variant="secondary"
            size="sm"
            className={styles.guestPickerClose}
            onClick={(event) => {
              event.stopPropagation();
              setIsGuestPickerOpen(false);
            }}
          >
            닫기
          </Button>
        </div>
      )}
    </div>
  );
}

export function BookingCouponSection({
  couponDiscount,
  coupons,
  handleIssueCoupon,
  isLoadingCoupons,
  issuingCouponId,
  selectedCoupon,
  selectedCouponId,
  setSelectedCouponId,
  totalPrice,
}: BookingCouponSectionProps) {
  return (
    <div className={styles.couponSection}>
      <div className={styles.couponHeader}>
        <div className={styles.couponTitle}>쿠폰</div>
        {selectedCoupon && couponDiscount > 0 && (
          <button
            type="button"
            className={styles.couponClearButton}
            onClick={() => setSelectedCouponId(null)}
          >
            해제
          </button>
        )}
      </div>
      {isLoadingCoupons ? (
        <div className={styles.couponEmpty}>쿠폰을 불러오는 중입니다.</div>
      ) : coupons.length === 0 ? (
        <div className={styles.couponEmpty}>발급 가능한 쿠폰이 없습니다.</div>
      ) : (
        <div className={styles.couponList}>
          {coupons.map((coupon) => {
            const discount = calculateCouponDiscount(coupon, totalPrice);
            const isApplicable = discount > 0;
            const isSelected = selectedCouponId === coupon.id && isApplicable;
            const isIssuing = issuingCouponId === coupon.id;
            const remaining =
              coupon.total_quantity == null
                ? null
                : Math.max(coupon.total_quantity - coupon.issued_quantity, 0);

            return (
              <div
                key={coupon.id}
                className={`${styles.couponItem} ${
                  isSelected ? styles.couponItemSelected : ""
                }`}
              >
                <div className={styles.couponInfo}>
                  <div className={styles.couponName}>{coupon.name}</div>
                  <div className={styles.couponMeta}>
                    {formatCouponDiscount(coupon)}
                    {coupon.min_payment_price != null &&
                      ` · ${coupon.min_payment_price.toLocaleString()}원 이상`}
                    {remaining != null &&
                      ` · 남은 수량 ${remaining.toLocaleString()}장`}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.couponApplyButton}
                  onClick={() => handleIssueCoupon(coupon)}
                  disabled={!isApplicable || isIssuing}
                >
                  {getCouponActionLabel({
                    isApplicable,
                    isIssuing,
                    isSelected,
                  })}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BookingPriceBreakdown({
  basePrice,
  couponDiscount,
  nights,
  selectedCoupon,
  totalPrice,
}: BookingPriceBreakdownProps) {
  if (couponDiscount <= 0) {
    return null;
  }

  return (
    <div className={styles.priceBreakdown}>
      <div className={styles.priceBreakdownRow}>
        <span>
          {nights}박 x ₩{basePrice.toLocaleString()}
        </span>
        <span>₩{totalPrice.toLocaleString()}</span>
      </div>
      <div className={styles.priceBreakdownRow}>
        <span>{selectedCoupon?.name}</span>
        <span>-₩{couponDiscount.toLocaleString()}</span>
      </div>
    </div>
  );
}

export function BookingReserveAction({
  isReserving,
  onReserve,
}: BookingReserveActionProps) {
  return (
    <>
      <Button
        fullWidth
        size="lg"
        className={styles.reserveButton}
        onClick={onReserve}
        isLoading={isReserving}
        loadingLabel="예약 중..."
      >
        예약하기
      </Button>

      <div className={styles.bookingNote}>
        예약 확정 전에는 요금이 청구되지 않습니다.
      </div>
    </>
  );
}
