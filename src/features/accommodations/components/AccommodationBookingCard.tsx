import React from "react";
import DatePicker from "../../../components/DatePicker/DatePicker";
import { AccommodationDetail } from "../../../types/accommodation";
import { CouponInfo } from "../../../types/coupon";
import {
  calculateCouponDiscount,
  formatCouponDiscount,
} from "../../../utils/codes";
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
  onReserve: () => void;
}

interface GuestCounterRowProps {
  title: string;
  subtitle: React.ReactNode;
  value: number;
  decrementDisabled: boolean;
  incrementDisabled: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
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
  AccommodationBookingCardProps,
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
  isSelected,
  isIssuing,
  isApplicable,
}: {
  isSelected: boolean;
  isIssuing: boolean;
  isApplicable: boolean;
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
  title,
  subtitle,
  value,
  decrementDisabled,
  incrementDisabled,
  onDecrement,
  onIncrement,
}: GuestCounterRowProps) {
  return (
    <div className={styles.guestPickerItem}>
      <div className={styles.guestPickerLabel}>
        <div className={styles.guestPickerTitle}>{title}</div>
        <div className={styles.guestPickerSubtitle}>{subtitle}</div>
      </div>
      <div className={styles.guestPickerControls}>
        <button
          type="button"
          className={`${styles.guestPickerButton} ${
            decrementDisabled ? styles.guestPickerButtonDisabled : ""
          }`}
          onClick={(event) => {
            event.stopPropagation();
            if (!decrementDisabled) {
              onDecrement();
            }
          }}
          disabled={decrementDisabled}
        >
          −
        </button>
        <span className={styles.guestPickerCount}>{value}</span>
        <button
          type="button"
          className={`${styles.guestPickerButton} ${
            incrementDisabled ? styles.guestPickerButtonDisabled : ""
          }`}
          onClick={(event) => {
            event.stopPropagation();
            if (!incrementDisabled) {
              onIncrement();
            }
          }}
          disabled={incrementDisabled}
        >
          +
        </button>
      </div>
    </div>
  );
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
  onReserve,
}: AccommodationBookingCardProps) {
  const maxOccupancy = accommodation.policy.max_occupancy;
  const maxInfants = accommodation.policy.infant_occupancy;
  const maxPets = accommodation.policy.pet_occupancy;
  const guestCount = adultCount + childCount;

  return (
    <div className={styles.bookingCard}>
      <div className={styles.priceSection}>
        <span className={styles.totalPrice}>
          ₩{payablePrice.toLocaleString()}
        </span>
        <span className={styles.priceInfo}>· {nights}박</span>
      </div>

      <div className={styles.dateSection} ref={dateSectionRef}>
        <div
          className={styles.dateRow}
          onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
          style={{ cursor: "pointer" }}
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
        </div>
        <div className={styles.horizontalDivider} />

        {isDatePickerOpen && (
          <div className={styles.datePickerContainer}>
            <DatePicker
              checkIn={checkIn}
              checkOut={checkOut}
              onDateSelect={handleDateSelect}
              onClose={() => setIsDatePickerOpen(false)}
              datePickerRef={datePickerRef}
              unavailableDates={accommodation.unavailable_dates.map(
                toUnavailableDate
              )}
            />
          </div>
        )}
      </div>

      <div
        className={`${styles.guestRowContainer} ${
          isDatePickerOpen ? styles.hidden : ""
        }`}
        ref={guestPickerRef}
      >
        <div
          className={styles.guestRow}
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
        </div>

        {isGuestPickerOpen && (
          <div className={styles.guestPicker}>
            <GuestCounterRow
              title="성인"
              subtitle="13세 이상"
              value={adultCount}
              decrementDisabled={adultCount <= 1}
              incrementDisabled={guestCount >= maxOccupancy}
              onDecrement={() => setAdultCount(adultCount - 1)}
              onIncrement={() => setAdultCount(adultCount + 1)}
            />

            <GuestCounterRow
              title="어린이"
              subtitle="2~12세"
              value={childCount}
              decrementDisabled={childCount <= 0}
              incrementDisabled={guestCount >= maxOccupancy}
              onDecrement={() => setChildCount(childCount - 1)}
              onIncrement={() => setChildCount(childCount + 1)}
            />

            <GuestCounterRow
              title="유아"
              subtitle="2세 미만"
              value={infantCount}
              decrementDisabled={infantCount <= 0 || maxInfants === 0}
              incrementDisabled={infantCount >= maxInfants || maxInfants === 0}
              onDecrement={() => setInfantCount(infantCount - 1)}
              onIncrement={() => setInfantCount(infantCount + 1)}
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
              decrementDisabled={petCount <= 0 || maxPets === 0}
              incrementDisabled={petCount >= maxPets || maxPets === 0}
              onDecrement={() => setPetCount(petCount - 1)}
              onIncrement={() => setPetCount(petCount + 1)}
            />

            <div className={styles.guestPickerNote}>
              이 숙소의 최대 숙박 인원은 {maxOccupancy}명(유아 제외)입니다.{" "}
              {maxPets === 0 && "반려동물 동반은 허용되지 않습니다."}
            </div>

            <button
              type="button"
              className={styles.guestPickerClose}
              onClick={(event) => {
                event.stopPropagation();
                setIsGuestPickerOpen(false);
              }}
            >
              닫기
            </button>
          </div>
        )}
      </div>

      {isAuthenticated && (
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
                const isSelected =
                  selectedCouponId === coupon.id && isApplicable;
                const isIssuing = issuingCouponId === coupon.id;
                const remaining =
                  coupon.total_quantity == null
                    ? null
                    : Math.max(
                        coupon.total_quantity - coupon.issued_quantity,
                        0
                      );

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
                        isSelected,
                        isIssuing,
                        isApplicable,
                      })}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {couponDiscount > 0 && (
        <div className={styles.priceBreakdown}>
          <div className={styles.priceBreakdownRow}>
            <span>
              {nights}박 x ₩{accommodation.base_price.toLocaleString()}
            </span>
            <span>₩{totalPrice.toLocaleString()}</span>
          </div>
          <div className={styles.priceBreakdownRow}>
            <span>{selectedCoupon?.name}</span>
            <span>-₩{couponDiscount.toLocaleString()}</span>
          </div>
        </div>
      )}

      <button type="button" className={styles.reserveButton} onClick={onReserve}>
        예약하기
      </button>

      <div className={styles.bookingNote}>
        예약 확정 전에는 요금이 청구되지 않습니다.
      </div>
    </div>
  );
}
