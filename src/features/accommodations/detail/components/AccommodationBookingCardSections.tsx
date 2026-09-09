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
  hasCompleteStay: boolean;
  payablePrice: number;
  totalPrice: number;
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
  nights: number;
  onDatePickerOpenChange: (isOpen: boolean) => void;
  onGuestPickerOpenChange: (isOpen: boolean) => void;
  disabledRanges: readonly {
    readonly startInclusive: string;
    readonly endExclusive: string;
  }[];
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
  onDatePickerOpenChange: (isOpen: boolean) => void;
  onGuestPickerOpenChange: (isOpen: boolean) => void;
  onPetCountChange: (count: number) => void;
  selectionLocked: boolean;
}

interface BookingCouponSectionProps {
  onRetry: () => void;
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
  buttonRef?: React.RefObject<HTMLButtonElement | null> | undefined;
  availabilityStatus: "loading" | "error" | "ready";
  hasCompleteStay: boolean;
  isReservationLocked: boolean;
  isReserving: boolean;
  isStayReady: boolean;
  onReserve: () => void;
  onRequestDates: () => void;
  reservationStatus:
    | "idle"
    | "quoting"
    | "quoted"
    | "checking-out"
    | "terminal-ready"
    | "completing"
    | "locked";
  retryAvailability: () => void;
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

const bookingSelectionGuidance: Record<
  Exclude<BookingReserveActionProps["selectionState"], "ready">,
  string
> = {
  "availability-unavailable":
    "예약 가능 날짜 정보를 확인한 뒤 날짜를 다시 선택해주세요.",
  "fully-booked": "현재 예약 가능한 날짜가 없어요. 다른 숙소를 확인해주세요.",
  incomplete: "체크인과 체크아웃 날짜를 모두 선택해주세요.",
  invalid: "체크아웃은 체크인 다음 날짜부터 선택할 수 있어요.",
  "outside-window": "숙소의 예약 가능 기간 안에서 날짜를 다시 선택해주세요.",
  unavailable: "선택한 숙박 기간에 예약할 수 없는 날짜가 포함되어 있어요.",
};

const getBookingSelectionGuidance = ({
  availabilityStatus,
  selectionState,
}: Pick<BookingReserveActionProps, "availabilityStatus" | "selectionState">):
  string | null => {
  if (availabilityStatus === "loading") {
    return "예약 가능한 날짜를 확인하고 있어요. 확인이 끝나면 날짜를 선택할 수 있습니다.";
  }

  if (availabilityStatus === "error") {
    return "날짜 정보를 불러오지 못했어요. ‘날짜 다시 불러오기’를 눌러 확인해주세요.";
  }

  return selectionState === "ready" || selectionState === "incomplete"
    ? null
    : bookingSelectionGuidance[selectionState];
};

const getReservationProgressCopy = (
  reservationStatus: BookingReserveActionProps["reservationStatus"],
): { readonly announcement: string | null; readonly loadingLabel: string } => {
  if (reservationStatus === "quoting") {
    return {
      announcement: "서버에서 최종 요금을 확인하고 있습니다.",
      loadingLabel: "최종 요금 확인 중...",
    };
  }

  if (reservationStatus === "checking-out") {
    return {
      announcement: "예약을 처리하고 있습니다. 잠시만 기다려주세요.",
      loadingLabel: "예약 처리 중...",
    };
  }

  return {
    announcement: null,
    loadingLabel:
      reservationStatus === "completing"
        ? "예약 내역 갱신 중..."
        : "예약 중...",
  };
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
  hasCompleteStay,
  payablePrice,
  totalPrice,
}: BookingPriceHeaderProps) {
  if (!hasCompleteStay) {
    return (
      <div className={styles.priceSection} aria-label="예약 요금">
        <h2 className={styles.pricePrompt}>날짜를 선택해 요금 확인</h2>
      </div>
    );
  }

  const hasDiscount = totalPrice > payablePrice;

  return (
    <div className={styles.priceSection} aria-label="예약 요금">
      <span className={styles.priceHeading}>총액</span>
      {hasDiscount && (
        <del
          aria-label={`할인 전 총액 ₩${totalPrice.toLocaleString()}`}
          className={styles.originalPrice}
        >
          ₩{totalPrice.toLocaleString()}
        </del>
      )}
      <strong className={styles.totalPrice}>
        ₩{payablePrice.toLocaleString()}
      </strong>
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
  nights,
  onDatePickerOpenChange,
  onGuestPickerOpenChange,
  disabledRanges,
  selectionLocked,
  selectionWindow,
}: BookingDateSectionProps) {
  const checkInTriggerRef = React.useRef<HTMLButtonElement>(null);
  const checkOutTriggerRef = React.useRef<HTMLButtonElement>(null);
  const datePopoverRef = React.useRef<HTMLDivElement>(null);
  const availabilityStatusRef = React.useRef<HTMLDivElement>(null);
  const availabilityFocusOwnedRef = React.useRef(false);
  const previousAvailabilityStatusRef = React.useRef(availabilityStatus);
  const wasDatePickerOpenRef = React.useRef(isDatePickerOpen);
  const endpointWasDatePickerOpenRef = React.useRef(isDatePickerOpen);
  const openedFromDateFieldRef = React.useRef(false);
  const [activeEndpoint, setActiveEndpoint] = React.useState<
    "checkIn" | "checkOut"
  >(checkIn && !checkOut ? "checkOut" : "checkIn");
  const [isReplacingCheckout, setIsReplacingCheckout] = React.useState(false);
  const activeTriggerRef =
    activeEndpoint === "checkOut" ? checkOutTriggerRef : checkInTriggerRef;
  const closeDatePicker = React.useCallback(() => {
    onDatePickerOpenChange(false);
    setIsReplacingCheckout(false);
    activeTriggerRef.current?.focus();
  }, [activeTriggerRef, onDatePickerOpenChange]);
  const dateOverlay = useNonModalOverlayRegistration({
    enabled: availabilityStatus === "ready" && isDatePickerOpen,
    onClose: closeDatePicker,
    overlayRef: datePopoverRef,
    triggerRef: activeTriggerRef,
  });
  const openDatePicker = React.useCallback(
    (endpoint: "checkIn" | "checkOut") => {
      if (availabilityStatus !== "ready" || selectionLocked) return;
      openedFromDateFieldRef.current = true;
      setActiveEndpoint(endpoint);
      setIsReplacingCheckout(
        endpoint === "checkOut" && Boolean(checkIn && checkOut),
      );
      onGuestPickerOpenChange(false);
      onDatePickerOpenChange(true);
    },
    [
      availabilityStatus,
      checkIn,
      checkOut,
      onDatePickerOpenChange,
      onGuestPickerOpenChange,
      selectionLocked,
    ],
  );
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

  React.useEffect(() => {
    const isOpening = isDatePickerOpen && !endpointWasDatePickerOpenRef.current;
    endpointWasDatePickerOpenRef.current = isDatePickerOpen;
    if (isOpening && !openedFromDateFieldRef.current) {
      setActiveEndpoint(checkIn && !checkOut ? "checkOut" : "checkIn");
      setIsReplacingCheckout(false);
    }
    if (!isDatePickerOpen) {
      setIsReplacingCheckout(false);
    }
    openedFromDateFieldRef.current = false;
  }, [checkIn, checkOut, isDatePickerOpen]);

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
      activeTriggerRef.current?.focus();
      availabilityFocusOwnedRef.current = false;
    }
  }, [
    availabilityStatus,
    dateSectionRef,
    focusAvailabilityStatus,
    isDatePickerOpen,
    activeTriggerRef,
  ]);

  const pickerCheckOut = isReplacingCheckout ? null : checkOut;
  const isReplacingPartialCheckIn =
    activeEndpoint === "checkIn" && Boolean(checkIn && !checkOut);
  const calendarTitle = isReplacingPartialCheckIn
    ? "체크인 날짜를 선택하세요"
    : checkIn && checkOut && nights > 0
      ? `${nights}박`
      : checkIn
        ? "체크아웃 날짜를 선택하세요"
        : "여행 날짜를 선택하세요";
  const calendarDescription = isReplacingPartialCheckIn
    ? "새 체크인 날짜를 선택하세요."
    : checkIn && checkOut
      ? `${formatDate(checkIn)} – ${formatDate(checkOut)}`
      : checkIn
        ? `${formatDate(checkIn)} 이후`
        : "날짜를 선택해 요금을 확인하세요.";
  const handlePickerDateSelect = React.useCallback(
    (nextCheckIn: Date | null, nextCheckOut: Date | null) => {
      setIsReplacingCheckout(false);
      if (!nextCheckIn) {
        setActiveEndpoint("checkIn");
      } else if (!nextCheckOut) {
        setActiveEndpoint("checkOut");
      }
      handleDateSelect(nextCheckIn, nextCheckOut);
    },
    [handleDateSelect],
  );

  return (
    <div
      className={`${styles.dateSection} ${
        isDatePickerOpen ? styles.dateSectionOpen : ""
      }`}
      ref={dateSectionRef}
      onBlurCapture={handleAvailabilityBoundaryBlur}
      onFocusCapture={handleAvailabilityBoundaryFocus}
    >
      <div className={styles.dateRow}>
        <button
          ref={checkInTriggerRef}
          type="button"
          className={`${styles.dateColumn} ${
            isDatePickerOpen && activeEndpoint === "checkIn"
              ? styles.dateColumnActive
              : ""
          }`}
          aria-label={`체크인 ${formatDate(checkIn) || "날짜 추가"}`}
          aria-haspopup="dialog"
          aria-expanded={isDatePickerOpen}
          aria-controls="booking-date-picker"
          aria-busy={availabilityStatus === "loading"}
          disabled={availabilityStatus !== "ready" || selectionLocked}
          onClick={() => openDatePicker("checkIn")}
        >
          <div className={styles.dateLabel}>체크인</div>
          <div
            className={`${styles.dateValue} ${checkIn ? "" : styles.datePlaceholder}`}
          >
            {formatDate(checkIn) || "날짜 추가"}
          </div>
        </button>
        <div className={styles.dateDivider} />
        <button
          ref={checkOutTriggerRef}
          type="button"
          className={`${styles.dateColumn} ${
            isDatePickerOpen && activeEndpoint === "checkOut"
              ? styles.dateColumnActive
              : ""
          }`}
          aria-label={`체크아웃 ${formatDate(checkOut) || "날짜 추가"}`}
          aria-haspopup="dialog"
          aria-expanded={isDatePickerOpen}
          aria-controls="booking-date-picker"
          aria-busy={availabilityStatus === "loading"}
          disabled={availabilityStatus !== "ready" || selectionLocked}
          onClick={() => openDatePicker("checkOut")}
        >
          <div className={styles.dateLabel}>체크아웃</div>
          <div
            className={`${styles.dateValue} ${checkOut ? "" : styles.datePlaceholder}`}
          >
            {formatDate(checkOut) || "날짜 추가"}
          </div>
        </button>
      </div>

      {availabilityStatus !== "ready" && (
        <div
          ref={availabilityStatusRef}
          className={styles.availabilityAnnouncement}
          aria-label="예약 가능 여부"
          role={availabilityStatus === "error" ? "alert" : "status"}
          tabIndex={-1}
        >
          {availabilityStatus === "loading"
            ? "예약 가능한 날짜를 확인하고 있습니다."
            : "예약 가능한 날짜를 불러오지 못했습니다."}
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
          <div className={styles.calendarSummary} aria-hidden="true">
            <strong>{calendarTitle}</strong>
            <span>{calendarDescription}</span>
          </div>
          <DatePicker
            variant="compact"
            checkIn={checkIn}
            checkOut={pickerCheckOut}
            selectionEndpoint={activeEndpoint}
            onDateSelect={handlePickerDateSelect}
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
  onDatePickerOpenChange,
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
    <div className={styles.guestRowContainer} ref={guestPickerRef}>
      <button
        ref={guestTriggerRef}
        type="button"
        className={styles.guestRow}
        aria-expanded={isGuestPickerOpen}
        aria-controls="booking-guest-picker"
        disabled={selectionLocked}
        onClick={() => {
          const willOpen = !isGuestPickerOpen;
          if (willOpen) onDatePickerOpenChange(false);
          onGuestPickerOpenChange(willOpen);
        }}
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
  onRetry,
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
        <button
          type="button"
          className={styles.couponClearButton}
          disabled={selectionLocked || isLoadingCoupons}
          onClick={onRetry}
        >
          새로고침
        </button>
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
        <div className={styles.couponEmpty}>
          보유하거나 발급받을 수 있는 쿠폰이 없습니다.
        </div>
      ) : (
        <div className={styles.couponList}>
          {coupons.map((coupon) => {
            return (
              <div
                key={coupon.id}
                role="group"
                aria-label={coupon.name}
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
                    selectionLocked ||
                    !coupon.isActionEnabled ||
                    coupon.isIssuing ||
                    coupon.isSelected
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
  buttonRef,
  availabilityStatus,
  hasCompleteStay,
  isReservationLocked,
  isReserving,
  isStayReady,
  onReserve,
  onRequestDates,
  reservationStatus,
  retryAvailability,
  selectionState,
}: BookingReserveActionProps) {
  const selectionGuidanceId = React.useId();
  const selectionGuidanceRef = React.useRef<HTMLParagraphElement>(null);
  const actionRef = React.useRef<HTMLButtonElement>(null);
  const availabilityRetryFocusOwnedRef = React.useRef(false);
  const canContinueExistingFlow =
    reservationStatus === "quoted" || reservationStatus === "terminal-ready";
  const selectionGuidance = canContinueExistingFlow
    ? null
    : getBookingSelectionGuidance({
        availabilityStatus,
        selectionState,
      });
  const { announcement: progressAnnouncement, loadingLabel } =
    getReservationProgressCopy(reservationStatus);
  const actionLabel = (() => {
    if (isReservationLocked) return "예약 내역 확인 필요";
    if (reservationStatus === "quoted") return "예약 계속하기";
    if (reservationStatus === "terminal-ready") return "예약 내역 확인";
    if (reservationStatus === "checking-out") return "예약 처리 중";
    if (reservationStatus === "completing") return "예약 내역 갱신 중";
    if (reservationStatus === "quoting") return "최종 요금 확인 중";
    if (availabilityStatus === "loading") return "예약 가능 날짜 확인 중";
    if (availabilityStatus === "error") return "날짜 다시 불러오기";

    switch (selectionState) {
      case "fully-booked":
        return "예약 가능한 날짜 없음";
      case "incomplete":
        return "예약 가능 여부 보기";
      case "invalid":
      case "outside-window":
      case "unavailable":
        return "예약 날짜 다시 선택";
      case "availability-unavailable":
        return "예약 가능 여부 보기";
      case "ready":
        return hasCompleteStay ? "예약하기" : "예약 가능 여부 보기";
    }
  })();
  const isFullyBooked = selectionState === "fully-booked";
  const shouldRetryAvailability =
    !canContinueExistingFlow && availabilityStatus === "error";
  const shouldRequestDates =
    !canContinueExistingFlow &&
    availabilityStatus === "ready" &&
    (!isStayReady || !hasCompleteStay || selectionState !== "ready");
  const isActionDisabled =
    isReservationLocked ||
    (!canContinueExistingFlow &&
      (availabilityStatus === "loading" || isFullyBooked));
  const handlePrimaryAction = () => {
    if (shouldRetryAvailability) {
      availabilityRetryFocusOwnedRef.current = true;
      selectionGuidanceRef.current?.focus();
      retryAvailability();
      return;
    }
    if (shouldRequestDates) {
      onRequestDates();
      return;
    }
    onReserve();
  };
  const releaseAvailabilityRetryFocus = React.useCallback(
    (event: React.FocusEvent<HTMLParagraphElement>) => {
      const nextTarget = event.relatedTarget;
      if (
        nextTarget instanceof Node &&
        event.currentTarget.contains(nextTarget)
      ) {
        return;
      }

      availabilityRetryFocusOwnedRef.current = false;
    },
    [],
  );

  React.useLayoutEffect(() => {
    if (!availabilityRetryFocusOwnedRef.current) return;

    const activeElement = document.activeElement;
    const guidance = selectionGuidanceRef.current;
    if (
      activeElement &&
      activeElement !== document.body &&
      activeElement !== guidance
    ) {
      availabilityRetryFocusOwnedRef.current = false;
      return;
    }

    if (availabilityStatus === "ready") {
      actionRef.current?.focus();
      availabilityRetryFocusOwnedRef.current = false;
      return;
    }

    selectionGuidanceRef.current?.focus();
  }, [availabilityStatus, selectionGuidance]);

  return (
    <>
      {progressAnnouncement && (
        <span
          className={styles.statusAnnouncement}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {progressAnnouncement}
        </span>
      )}

      {selectionGuidance && (
        <p
          ref={selectionGuidanceRef}
          className={styles.selectionGuidance}
          id={selectionGuidanceId}
          tabIndex={-1}
          onBlur={releaseAvailabilityRetryFocus}
        >
          {selectionGuidance}
        </p>
      )}

      <Button
        ref={(element) => {
          actionRef.current = element;
          if (buttonRef) buttonRef.current = element;
        }}
        fullWidth
        size="lg"
        className={styles.reserveButton}
        aria-describedby={selectionGuidance ? selectionGuidanceId : undefined}
        disabled={isActionDisabled}
        onClick={handlePrimaryAction}
        isLoading={isReserving}
        loadingLabel={loadingLabel}
      >
        {actionLabel}
      </Button>

      {(hasCompleteStay || canContinueExistingFlow) && (
        <div className={styles.bookingNote}>
          예약 확정 전에는 요금이 청구되지 않습니다.
        </div>
      )}
    </>
  );
}

export function BookingQuoteSummary({
  amount,
  canAbandon,
  currency,
  discountAmount,
  onAbandonQuote,
  quoteExpiresAt,
  subtotal,
}: BookingQuoteSummaryProps) {
  const expiryDescriptionId = React.useId();
  const quoteExpiry = new Date(quoteExpiresAt);
  const hasExactQuoteExpiry = !Number.isNaN(quoteExpiry.getTime());
  const quoteExpiryLabel = hasExactQuoteExpiry
    ? quoteExpiry.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "유효 시간 내";

  return (
    <section
      className={styles.quoteSummary}
      aria-describedby={expiryDescriptionId}
      aria-label="확정된 예약 견적"
    >
      <div className={styles.quoteSummaryHeader}>
        <span className={styles.quoteSummaryBadge}>서버 견적</span>
        <strong>서버에서 확인한 최종 요금</strong>
        <span className={styles.quoteSummaryDescription}>
          아래 금액을 확인한 뒤 예약을 계속해주세요.
        </span>
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
        <strong>₩{amount.toLocaleString("ko-KR")}</strong>
      </div>
      <div className={styles.quoteSummaryFooter}>
        <p className={styles.quoteExpiry} id={expiryDescriptionId}>
          <span>견적 유효 시각</span>
          <strong>
            {hasExactQuoteExpiry ? (
              <time dateTime={quoteExpiresAt}>{quoteExpiryLabel}까지</time>
            ) : (
              quoteExpiryLabel
            )}
          </strong>
        </p>
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
    </section>
  );
}
