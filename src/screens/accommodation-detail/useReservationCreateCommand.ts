import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  calculateAccommodationCouponDiscount,
  type AccommodationCoupon,
} from "../../features/accommodations/detail/public";
import { useStrictModeSafeDisposable } from "../../shared/lib/useStrictModeSafeDisposable";
import {
  createReservationCreateWorkflow,
  reservationCreateTransport,
  type AppliedReservationCoupon,
  type ReservationCheckoutHandoffPort,
  type ReservationCreateRouteLease,
  type ReservationCreateSessionPort,
  type ReservationStartIntent,
} from "../../workflows/booking-payment/reservation-create";
import { toAccommodationErrorMessage } from "./accommodationDetailErrors";
import { deriveBookingDates, formatBookingLocalDate } from "./bookingDraft";

interface ReservationAccommodationSnapshot {
  readonly basePrice: number;
  readonly id: number;
  readonly policy: {
    readonly infantOccupancy: number;
    readonly maxOccupancy: number;
    readonly petOccupancy: number;
  };
  readonly unavailableDates: readonly string[];
}

interface ReservationBookingDates {
  readonly checkIn: Date | null;
  readonly checkOut: Date | null;
  readonly totalPrice: number;
}

interface ReservationGuestCounts {
  readonly adultCount: number;
  readonly childCount: number;
  readonly infantCount: number;
  readonly petCount: number;
}

interface UseReservationCreateCommandOptions {
  readonly accommodation: ReservationAccommodationSnapshot | null;
  readonly bookingDates: ReservationBookingDates;
  readonly checkoutHandoff: ReservationCheckoutHandoffPort;
  readonly guestCounts: ReservationGuestCounts;
  readonly onError: (message: string | null) => void;
  readonly requestAuthentication: (intent: ReservationStartIntent) => void;
  readonly routeLease: ReservationCreateRouteLease;
  readonly scope: { readonly epoch: number; readonly subject: string | null };
  readonly selectedCoupon: AccommodationCoupon | null;
  readonly session: ReservationCreateSessionPort;
}

const ambiguousReservationMessage =
  "예약 처리 결과를 확인할 수 없습니다. 예약 내역에서 확인해주세요.";
const activePaymentMessage = "진행 중인 결제 상태를 먼저 확인해주세요.";

const toAppliedCoupon = (
  coupon: AccommodationCoupon | null,
  totalPrice: number,
): AppliedReservationCoupon | null => {
  if (!coupon) return null;
  const discount = calculateAccommodationCouponDiscount(coupon, totalPrice);
  return discount > 0 ? { id: coupon.id, name: coupon.name, discount } : null;
};

export const useReservationCreateCommand = ({
  accommodation,
  bookingDates,
  checkoutHandoff,
  guestCounts,
  onError,
  requestAuthentication,
  routeLease,
  scope,
  selectedCoupon,
  session,
}: UseReservationCreateCommandOptions) => {
  const [isReserving, setIsReserving] = useState(false);
  const [isReservationLocked, setIsReservationLocked] = useState(false);
  const activeReservationRef = useRef<Promise<unknown> | null>(null);
  const terminalLockRef = useRef(false);
  const workflowGeneration = useMemo(
    () => ({
      checkoutHandoff,
      routeLease,
      scopeEpoch: scope.epoch,
      scopeSubject: scope.subject,
      session,
    }),
    [checkoutHandoff, routeLease, scope.epoch, scope.subject, session],
  );
  const workflow = useMemo(
    () =>
      createReservationCreateWorkflow({
        handoff: workflowGeneration.checkoutHandoff,
        session: workflowGeneration.session,
        transport: reservationCreateTransport,
      }),
    [workflowGeneration],
  );
  useStrictModeSafeDisposable(workflow);

  useLayoutEffect(() => {
    const interruptedReservation = activeReservationRef.current;
    activeReservationRef.current = null;
    setIsReserving(false);

    if (interruptedReservation) {
      terminalLockRef.current = true;
      setIsReservationLocked(true);
      onError(ambiguousReservationMessage);
    }
  }, [onError, routeLease, workflow]);

  const startReservation = useCallback(
    async (
      resumeIntent?: ReservationStartIntent,
      resumedCoupon?: AccommodationCoupon | null,
    ) => {
      if (!accommodation || activeReservationRef.current) return;
      if (terminalLockRef.current) {
        onError(ambiguousReservationMessage);
        return;
      }

      const intent: ReservationStartIntent = resumeIntent ?? {
        type: "reservation.start",
        accommodationId: accommodation.id,
        checkIn: bookingDates.checkIn
          ? formatBookingLocalDate(bookingDates.checkIn)
          : "",
        checkOut: bookingDates.checkOut
          ? formatBookingLocalDate(bookingDates.checkOut)
          : "",
        ...guestCounts,
        couponId:
          toAppliedCoupon(selectedCoupon, bookingDates.totalPrice)?.id ?? null,
      };
      const intendedDates = deriveBookingDates({
        basePrice: accommodation.basePrice,
        checkIn: intent.checkIn,
        checkOut: intent.checkOut,
        unavailableDates: accommodation.unavailableDates,
      });
      const coupon = resumeIntent ? (resumedCoupon ?? null) : selectedCoupon;
      const appliedCoupon = toAppliedCoupon(coupon, intendedDates.totalPrice);
      const pending = workflow.start({
        accommodation: {
          id: accommodation.id,
          maxOccupancy: accommodation.policy.maxOccupancy,
          maxInfants: accommodation.policy.infantOccupancy,
          maxPets: accommodation.policy.petOccupancy,
          unavailableDates: accommodation.unavailableDates,
        },
        appliedCoupon,
        intent,
        routeLease,
      });
      activeReservationRef.current = pending;
      setIsReserving(true);
      onError(null);

      try {
        const result = await pending;
        if (
          activeReservationRef.current !== pending ||
          !routeLease.isCurrent()
        ) {
          return;
        }

        switch (result.status) {
          case "auth-required":
            requestAuthentication(result.intent);
            return;
          case "invalid":
            onError(result.error.message);
            return;
          case "definitive-failure":
            onError(toAccommodationErrorMessage(result.error));
            return;
          case "checkout-blocked":
            onError(activePaymentMessage);
            return;
          case "payment-recovery-required":
            return;
          case "ambiguous":
            terminalLockRef.current = true;
            setIsReservationLocked(true);
            onError(ambiguousReservationMessage);
            return;
          case "locked":
            if (result.terminal === "ambiguous") {
              terminalLockRef.current = true;
              setIsReservationLocked(true);
              onError(ambiguousReservationMessage);
            }
            return;
          case "handed-off":
          case "stale":
            return;
        }
      } finally {
        if (activeReservationRef.current === pending) {
          activeReservationRef.current = null;
          setIsReserving(false);
        }
      }
    },
    [
      accommodation,
      bookingDates,
      guestCounts,
      onError,
      requestAuthentication,
      routeLease,
      selectedCoupon,
      workflow,
    ],
  );

  return { isReservationLocked, isReserving, startReservation };
};
