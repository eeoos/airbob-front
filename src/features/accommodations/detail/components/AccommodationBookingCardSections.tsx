import React from "react";
import type { AccommodationBookingCouponViewModel } from "../lib/accommodationBookingSectionsViewModel";
import {
  Button,
  CounterStepper,
  DatePicker,
  useNonModalOverlayRegistration,
} from "../../../../shared/ui";
import styles from "./AccommodationBookingCard.module.css";

interface BookingPriceHeaderProps {
  nights: number;
  payablePrice: number;
}

interface BookingDateSectionProps {
  availabilityStatus: "loading" | "error" | "ready";
  checkIn: Date | null;
  checkOut: Date | null;
  datePickerRef: React.RefObject<HTMLDivElement | null>;
  dateSectionRef: React.RefObject<HTMLDivElement | null>;
  formatDate: (date: Date | null) => string;
  handleDateSelect: (checkIn: Date | null, checkOut: Date | null) => void;
  isDatePickerOpen: boolean;
  onDatePickerOpenChange: (isOpen: boolean) => void;
  onGuestPickerOpenChange: (isOpen: boolean) => void;
  disabledRanges: readonly {
    readonly startInclusive: string;
    readonly endExclusive: string;
  }[];
  retryAvailability: () => void;
  selectionLocked: boolean;
  selectionWindow: {
    readonly startInclusive: string;
    readonly endExclusive: string;
  } | null;
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
  onAdultCountChange: (count: number) => void;
  onChildCountChange: (count: number) => void;
  onInfantCountChange: (count: number) => void;
  onGuestPickerOpenChange: (isOpen: boolean) => void;
  onPetCountChange: (count: number) => void;
  selectionLocked: boolean;
}

interface BookingCouponSectionProps {
  couponDiscount: number;
  coupons: AccommodationBookingCouponViewModel[];
  errorMessage: string | null;
  handleIssueCoupon: (
    coupon: AccommodationBookingCouponViewModel,
  ) => void | Promise<void>;
  isLoadingCoupons: boolean;
  selectedCoupon: AccommodationBookingCouponViewModel | null;
  onSelectedCouponIdChange: (couponId: number | null) => void;
  selectionLocked: boolean;
}

interface BookingPriceBreakdownProps {
  basePrice: number;
  couponDiscount: number;
  nights: number;
  selectedCoupon: AccommodationBookingCouponViewModel | null;
  totalPrice: number;
}

interface BookingReserveActionProps {
  availabilityStatus: "loading" | "error" | "ready";
  hasCompleteStay: boolean;
  isReservationLocked: boolean;
  isReserving: boolean;
  isStayReady: boolean;
  onReserve: () => void;
  reservationStatus:
    | "idle"
    | "quoting"
    | "quoted"
    | "checking-out"
    | "terminal-ready"
    | "completing"
    | "locked";
  selectionState:
    | "availability-unavailable"
    | "fully-booked"
    | "incomplete"
    | "invalid"
    | "outside-window"
    | "ready"
    | "unavailable";
}

interface BookingQuoteSummaryProps {
  readonly amount: number;
  readonly canAbandon: boolean;
  readonly currency: string;
  readonly discountAmount: number;
  readonly onAbandonQuote: () => boolean;
  readonly quoteExpiresAt: string;
  readonly subtotal: number;
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
        value={value}
        onChange={onChange}
        {...(max === undefined ? {} : { max })}
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
      <span className={styles.totalPrice}>
        ₩{payablePrice.toLocaleString()}
      </span>
      <span className={styles.priceInfo}>· {nights}박</span>
    </div>
  );
}

export function BookingDateSection({
  availabilityStatus,
  checkIn,
  checkOut,
  datePickerRef,
  dateSectionRef,
  formatDate,
  handleDateSelect,
  isDatePickerOpen,
  onDatePickerOpenChange,
  onGuestPickerOpenChange,
  disabledRanges,
  retryAvailability,
  selectionLocked,
  selectionWindow,
}: BookingDateSectionProps) {
  const dateTriggerRef = React.useRef<HTMLButtonElement>(null);
  const datePopoverRef = React.useRef<HTMLDivElement>(null);
  const availabilityStatusRef = React.useRef<HTMLDivElement>(null);
  const availabilityFocusOwnedRef = React.useRef(false);
  const previousAvailabilityStatusRef = React.useRef(availabilityStatus);
  const wasDatePickerOpenRef = React.useRef(isDatePickerOpen);
  const closeDatePicker = React.useCallback(() => {
    onDatePickerOpenChange(false);
    dateTriggerRef.current?.focus();
  }, [onDatePickerOpenChange]);
  const dateOverlay = useNonModalOverlayRegistration({
    enabled: availabilityStatus === "ready" && isDatePickerOpen,
    onClose: closeDatePicker,
    overlayRef: datePopoverRef,
    triggerRef: dateTriggerRef,
  });
  const toggleDatePicker = React.useCallback(() => {
    if (availabilityStatus !== "ready" || selectionLocked) return;
    const willOpen = !isDatePickerOpen;
    if (willOpen) onGuestPickerOpenChange(false);
    onDatePickerOpenChange(willOpen);
  }, [
    availabilityStatus,
    isDatePickerOpen,
    onDatePickerOpenChange,
    onGuestPickerOpenChange,
    selectionLocked,
  ]);
  const focusAvailabilityStatus = React.useCallback(() => {
    const statusTarget = availabilityStatusRef.current;
    if (!statusTarget) return;

    availabilityFocusOwnedRef.current = true;
    statusTarget.focus();
  }, []);
  const handleAvailabilityBoundaryFocus = React.useCallback(() => {
    availabilityFocusOwnedRef.current = true;
  }, []);
  const handleAvailabilityBoundaryBlur = React.useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const nextTarget = event.relatedTarget;
      if (
        nextTarget instanceof Node &&
        event.currentTarget.contains(nextTarget)
      ) {
        return;
      }

      availabilityFocusOwnedRef.current = false;
    },
    [],
  );
  const handleRetryAvailability = React.useCallback(() => {
    focusAvailabilityStatus();
    retryAvailability();
  }, [focusAvailabilityStatus, retryAvailability]);

  React.useLayoutEffect(() => {
    const previousAvailabilityStatus = previousAvailabilityStatusRef.current;
    const wasDatePickerOpen = wasDatePickerOpenRef.current;
    previousAvailabilityStatusRef.current = availabilityStatus;
    wasDatePickerOpenRef.current = isDatePickerOpen;
    const activeElement = document.activeElement;
    const dateSection = dateSectionRef.current;
    const focusIsExplicitlyOutside = Boolean(
      activeElement &&
      activeElement !== document.body &&
      dateSection &&
      !dateSection.contains(activeElement),
    );

    if (focusIsExplicitlyOutside) {
      availabilityFocusOwnedRef.current = false;
    }

    if (availabilityStatus !== "ready") {
      if (wasDatePickerOpen && !isDatePickerOpen && !focusIsExplicitlyOutside) {
        availabilityFocusOwnedRef.current = true;
      }
      if (availabilityFocusOwnedRef.current) {
        focusAvailabilityStatus();
      }
      return;
    }

    if (
      previousAvailabilityStatus !== "ready" &&
      availabilityFocusOwnedRef.current
    ) {
      dateTriggerRef.current?.focus();
      availabilityFocusOwnedRef.current = false;
    }
  }, [
    availabilityStatus,
    dateSectionRef,
    focusAvailabilityStatus,
    isDatePickerOpen,
  ]);

  return (
    <div
      className={styles.dateSection}
      ref={dateSectionRef}
      onBlurCapture={handleAvailabilityBoundaryBlur}
      onFocusCapture={handleAvailabilityBoundaryFocus}
    >
      <button
        ref={dateTriggerRef}
        type="button"
        className={styles.dateRow}
        aria-expanded={isDatePickerOpen}
        aria-controls="booking-date-picker"
        aria-busy={availabilityStatus === "loading"}
        disabled={availabilityStatus !== "ready" || selectionLocked}
        onClick={toggleDatePicker}
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

      {availabilityStatus !== "ready" && (
        <div
          ref={availabilityStatusRef}
          className={styles.availabilityStatus}
          aria-label="예약 가능 여부"
          role={availabilityStatus === "error" ? "alert" : "status"}
          tabIndex={-1}
        >
          <span>
            {availabilityStatus === "loading"
              ? "예약 가능한 날짜를 확인하고 있습니다."
              : "예약 가능한 날짜를 불러오지 못했습니다."}
          </span>
          {availabilityStatus === "error" && (
            <button
              className={styles.availabilityRetryButton}
              type="button"
              onClick={handleRetryAvailability}
            >
              다시 시도
            </button>
          )}
        </div>
      )}

      {isDatePickerOpen && (
        <div
          ref={datePopoverRef}
          id="booking-date-picker"
          aria-label="예약 날짜 선택"
          className={styles.datePickerContainer}
          onKeyDownCapture={dateOverlay.onKeyDown}
          role="dialog"
          tabIndex={-1}
        >
          <DatePicker
            checkIn={checkIn}
            checkOut={checkOut}
            onDateSelect={handleDateSelect}
            onClose={closeDatePicker}
            onEscape={() => {
              dateOverlay.requestCloseOnEscape();
            }}
            datePickerRef={datePickerRef}
            disabledRanges={disabledRanges}
            {...(selectionWindow ? { selectionWindow } : {})}
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
  onAdultCountChange,
  onChildCountChange,
  onInfantCountChange,
  onGuestPickerOpenChange,
  onPetCountChange,
  selectionLocked,
}: BookingGuestSectionProps) {
  const guestCount = adultCount + childCount;
  const guestTriggerRef = React.useRef<HTMLButtonElement>(null);
  const guestPopoverRef = React.useRef<HTMLDivElement>(null);
  const closeGuestPicker = React.useCallback(() => {
    onGuestPickerOpenChange(false);
    guestTriggerRef.current?.focus();
  }, [onGuestPickerOpenChange]);
  const guestOverlay = useNonModalOverlayRegistration({
    enabled: isGuestPickerOpen && !isDatePickerOpen,
    onClose: closeGuestPicker,
    overlayRef: guestPopoverRef,
    triggerRef: guestTriggerRef,
  });

  return (
    <div
      className={`${styles.guestRowContainer} ${
        isDatePickerOpen ? styles.hidden : ""
      }`}
      ref={guestPickerRef}
    >
      <button
        ref={guestTriggerRef}
        type="button"
        className={styles.guestRow}
        aria-expanded={isGuestPickerOpen}
        aria-controls="booking-guest-picker"
        disabled={selectionLocked}
        onClick={() => onGuestPickerOpenChange(!isGuestPickerOpen)}
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
        <div className={styles.guestArrow}>{isGuestPickerOpen ? "⌃" : "⌄"}</div>
      </button>

      {isGuestPickerOpen && (
        <div
          ref={guestPopoverRef}
          id="booking-guest-picker"
          aria-label="예약 인원 선택"
          className={styles.guestPicker}
          onKeyDownCapture={guestOverlay.onKeyDown}
          role="dialog"
          tabIndex={-1}
        >
          <GuestCounterRow
            title="성인"
            subtitle="13세 이상"
            value={adultCount}
            decrementLabel="성인 줄이기"
            incrementLabel="성인 늘리기"
            min={1}
            max={adultCount + (maxOccupancy - guestCount)}
            onChange={onAdultCountChange}
          />

          <GuestCounterRow
            title="어린이"
            subtitle="2~12세"
            value={childCount}
            decrementLabel="어린이 줄이기"
            incrementLabel="어린이 늘리기"
            max={childCount + (maxOccupancy - guestCount)}
            onChange={onChildCountChange}
          />

          <GuestCounterRow
            title="유아"
            subtitle="2세 미만"
            value={infantCount}
            decrementLabel="유아 줄이기"
            incrementLabel="유아 늘리기"
            max={maxInfants}
            onChange={onInfantCountChange}
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
            onChange={onPetCountChange}
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
              closeGuestPicker();
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
  errorMessage,
  handleIssueCoupon,
  isLoadingCoupons,
  selectedCoupon,
  onSelectedCouponIdChange,
  selectionLocked,
}: BookingCouponSectionProps) {
  return (
    <div className={styles.couponSection}>
      <div className={styles.couponHeader}>
        <div className={styles.couponTitle}>쿠폰</div>
        {selectedCoupon && couponDiscount > 0 && (
          <button
            type="button"
            className={styles.couponClearButton}
            disabled={selectionLocked}
            onClick={() => onSelectedCouponIdChange(null)}
          >
            해제
          </button>
        )}
      </div>
      {isLoadingCoupons ? (
        <div className={styles.couponEmpty}>쿠폰을 불러오는 중입니다.</div>
      ) : errorMessage ? (
        <div className={styles.couponEmpty} role="alert">
          {errorMessage}
        </div>
      ) : coupons.length === 0 ? (
        <div className={styles.couponEmpty}>발급 가능한 쿠폰이 없습니다.</div>
      ) : (
        <div className={styles.couponList}>
          {coupons.map((coupon) => {
            return (
              <div
                key={coupon.id}
                className={`${styles.couponItem} ${
                  coupon.isSelected ? styles.couponItemSelected : ""
                }`}
              >
                <div className={styles.couponInfo}>
                  <div className={styles.couponName}>{coupon.name}</div>
                  <div className={styles.couponMeta}>
                    {coupon.metadataLabel}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.couponApplyButton}
                  onClick={() => handleIssueCoupon(coupon)}
                  disabled={
                    selectionLocked || !coupon.isApplicable || coupon.isIssuing
                  }
                >
                  {coupon.actionLabel}
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
  availabilityStatus,
  hasCompleteStay,
  isReservationLocked,
  isReserving,
  isStayReady,
  onReserve,
  reservationStatus,
  selectionState,
}: BookingReserveActionProps) {
  const canContinueExistingFlow =
    reservationStatus === "quoted" || reservationStatus === "terminal-ready";
  const loadingLabel =
    reservationStatus === "quoting"
      ? "최종 요금 확인 중..."
      : reservationStatus === "checking-out"
        ? "예약 처리 중..."
        : reservationStatus === "completing"
          ? "예약 내역 갱신 중..."
          : "예약 중...";
  const actionLabel = (() => {
    if (isReservationLocked) return "예약 내역 확인 필요";
    if (reservationStatus === "quoted") return "예약 계속하기";
    if (reservationStatus === "terminal-ready") return "예약 내역 확인";
    if (reservationStatus === "checking-out") return "예약 처리 중";
    if (reservationStatus === "completing") return "예약 내역 갱신 중";
    if (reservationStatus === "quoting") return "최종 요금 확인 중";
    if (availabilityStatus === "loading") return "예약 가능 날짜 확인 중";
    if (availabilityStatus === "error") return "예약 가능 날짜 확인 필요";

    switch (selectionState) {
      case "fully-booked":
        return "예약 가능한 날짜 없음";
      case "incomplete":
        return "체크인·체크아웃 선택";
      case "invalid":
      case "outside-window":
      case "unavailable":
        return "예약 날짜 다시 선택";
      case "availability-unavailable":
        return "예약 가능 날짜 확인 필요";
      case "ready":
        return hasCompleteStay ? "예약하기" : "체크인·체크아웃 선택";
    }
  })();

  return (
    <>
      <Button
        fullWidth
        size="lg"
        className={styles.reserveButton}
        disabled={
          isReservationLocked ||
          (!canContinueExistingFlow &&
            (availabilityStatus !== "ready" ||
              !isStayReady ||
              !hasCompleteStay))
        }
        onClick={onReserve}
        isLoading={isReserving}
        loadingLabel={loadingLabel}
      >
        {actionLabel}
      </Button>

      <div className={styles.bookingNote}>
        예약 확정 전에는 요금이 청구되지 않습니다.
      </div>
    </>
  );
}

const formatQuoteExpiry = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "유효 시간 내"
    : parsed.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
};

export function BookingQuoteSummary({
  amount,
  canAbandon,
  currency,
  discountAmount,
  onAbandonQuote,
  quoteExpiresAt,
  subtotal,
}: BookingQuoteSummaryProps) {
  return (
    <section className={styles.quoteSummary} aria-label="확정된 예약 견적">
      <div className={styles.quoteSummaryHeader}>
        <strong>서버에서 확인한 최종 요금</strong>
        {canAbandon && (
          <button
            className={styles.quoteResetButton}
            onClick={onAbandonQuote}
            type="button"
          >
            조건 다시 선택
          </button>
        )}
      </div>
      <div className={styles.quoteSummaryRow}>
        <span>숙박 요금</span>
        <span>₩{subtotal.toLocaleString("ko-KR")}</span>
      </div>
      {discountAmount > 0 && (
        <div className={styles.quoteSummaryRow}>
          <span>할인</span>
          <span>-₩{discountAmount.toLocaleString("ko-KR")}</span>
        </div>
      )}
      <div className={styles.quoteSummaryTotal}>
        <span>결제 예정 금액 ({currency})</span>
        <span>₩{amount.toLocaleString("ko-KR")}</span>
      </div>
      <p className={styles.quoteExpiry}>
        {formatQuoteExpiry(quoteExpiresAt)}까지 유효한 견적입니다.
      </p>
    </section>
  );
}
