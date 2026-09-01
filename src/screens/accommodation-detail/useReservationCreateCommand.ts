import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  calculateAccommodationCouponDiscount,
  type AccommodationAvailability,
  type AccommodationCoupon,
} from "../../features/accommodations/detail/public";
import type {
  BookingTransactionHandle,
  BookingTransactionRouteLease,
  BookingTransactionSnapshot,
  BookingTransactionStartIntent,
  BookingTransactionWorkflow,
} from "../../workflows/booking-payment/transaction/booking";
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

export type ReservationCreateCommandStatus =
  | "idle"
  | "quoting"
  | "quoted"
  | "checking-out"
  | "terminal-ready"
  | "completing"
  | "locked";

interface UseReservationCreateCommandOptions {
  readonly accommodation: ReservationAccommodationSnapshot | null;
  readonly availability: AccommodationAvailability | null;
  readonly bookingDates: ReservationBookingDates;
  readonly flowHandle: BookingTransactionHandle | null;
  readonly guestCounts: ReservationGuestCounts;
  readonly isRecoveryBlocked: boolean;
  readonly onFlowHandleChange: (
    handle: BookingTransactionHandle | null,
  ) => boolean;
  readonly onOpenPayment: (
    handle: BookingTransactionHandle,
    snapshot: BookingTransactionSnapshot,
  ) => void;
  readonly onOpenTrips: () => void;
  readonly onTerminalReservation: (
    handle: BookingTransactionHandle,
    snapshot: BookingTransactionSnapshot,
    routeLease: BookingTransactionRouteLease,
  ) => Promise<boolean>;
  readonly onError: (message: string | null) => void;
  readonly requestAuthentication: (
    intent: BookingTransactionStartIntent,
  ) => void;
  readonly routeLease: BookingTransactionRouteLease;
  readonly selectedCoupon: AccommodationCoupon | null;
  readonly workflow: BookingTransactionWorkflow;
}

const activePaymentMessage =
  "진행 중인 예약 또는 결제 상태를 먼저 확인해주세요.";

const toAppliedCoupon = (
  coupon: AccommodationCoupon | null,
  totalPrice: number,
) => {
  if (!coupon) return null;
  const discount = calculateAccommodationCouponDiscount(coupon, totalPrice);
  return discount > 0 ? { id: coupon.id, name: coupon.name, discount } : null;
};

const isTerminalPhase = (snapshot: BookingTransactionSnapshot): boolean =>
  snapshot.phase === "complimentary-observed" ||
  snapshot.phase === "reservation-status-observed" ||
  snapshot.phase === "hold-released";

const failureMessage = (code: string): string =>
  toAccommodationErrorMessage(Object.assign(new Error(code), { code }));

const isSameHandle = (
  left: BookingTransactionHandle,
  right: BookingTransactionHandle,
): boolean =>
  left.flowId === right.flowId &&
  left.locator.kind === right.locator.kind &&
  (left.locator.kind === "accommodation"
    ? right.locator.kind === "accommodation" &&
      left.locator.accommodationId === right.locator.accommodationId
    : right.locator.kind === "reservation" &&
      left.locator.reservationUid === right.locator.reservationUid);

export const useReservationCreateCommand = ({
  accommodation,
  availability,
  bookingDates,
  flowHandle,
  guestCounts,
  isRecoveryBlocked,
  onError,
  onFlowHandleChange,
  onOpenPayment,
  onOpenTrips,
  onTerminalReservation,
  requestAuthentication,
  routeLease,
  selectedCoupon,
  workflow,
}: UseReservationCreateCommandOptions) => {
  const [status, setStatus] = useState<ReservationCreateCommandStatus>("idle");
  const [snapshot, setSnapshot] = useState<BookingTransactionSnapshot | null>(
    null,
  );
  const activeCommandRef = useRef<Promise<unknown> | null>(null);
  const currentHandleRef = useRef<BookingTransactionHandle | null>(flowHandle);
  const liveQuotedCouponIdRef = useRef<number | null | undefined>(undefined);

  useLayoutEffect(() => {
    if (
      activeCommandRef.current &&
      flowHandle &&
      currentHandleRef.current &&
      isSameHandle(flowHandle, currentHandleRef.current)
    ) {
      return;
    }
    activeCommandRef.current = null;

    if (!flowHandle) {
      currentHandleRef.current = null;
      liveQuotedCouponIdRef.current = undefined;
      setSnapshot(null);
      setStatus("idle");
      return;
    }

    const loaded = workflow.load({ handle: flowHandle, routeLease });
    if (
      loaded.status === "ready" &&
      accommodation &&
      loaded.snapshot.accommodationId === accommodation.id
    ) {
      if (!isSameHandle(flowHandle, loaded.handle)) {
        // A verified load can promote the exact pre-checkout accommodation
        // locator after a crash between the journal and history writes.
        // Publish the reservation locator before exposing recovered UI state.
        if (!onFlowHandleChange(loaded.handle)) {
          currentHandleRef.current = flowHandle;
          setSnapshot(null);
          setStatus("locked");
          onError(activePaymentMessage);
          return;
        }
      }
      currentHandleRef.current = loaded.handle;
      setSnapshot(loaded.snapshot);
      setStatus(isTerminalPhase(loaded.snapshot) ? "terminal-ready" : "quoted");
      onError(null);
      return;
    }

    if (
      loaded.status === "missing" &&
      flowHandle.locator.kind === "accommodation"
    ) {
      // A prepared quote reference is published before the quote request.
      // With no journal there can be no checkout/hold, so this exact orphan is
      // safe to discard without owner-wide discovery.
      if (onFlowHandleChange(null)) {
        currentHandleRef.current = null;
        liveQuotedCouponIdRef.current = undefined;
        setSnapshot(null);
        setStatus("idle");
        onError(null);
      } else {
        currentHandleRef.current = flowHandle;
        setSnapshot(null);
        setStatus("locked");
        onError(activePaymentMessage);
      }
      return;
    }

    currentHandleRef.current = flowHandle;
    setSnapshot(null);
    setStatus("locked");
    if (loaded.status !== "stale" && loaded.status !== "locked") {
      onError(activePaymentMessage);
    }
  }, [
    accommodation,
    flowHandle,
    onError,
    onFlowHandleChange,
    routeLease,
    workflow,
  ]);

  const currentIntent = useCallback(
    (
      resumeIntent?: BookingTransactionStartIntent,
      resumedCoupon?: AccommodationCoupon | null,
    ): {
      readonly intent: BookingTransactionStartIntent;
      readonly coupon: AccommodationCoupon | null;
      readonly totalPrice: number;
    } | null => {
      if (!accommodation || !availability) return null;
      const intent: BookingTransactionStartIntent = resumeIntent ?? {
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
        availability,
        checkIn: intent.checkIn,
        checkOut: intent.checkOut,
      });
      return {
        intent,
        coupon: resumeIntent ? (resumedCoupon ?? null) : selectedCoupon,
        totalPrice: intendedDates.totalPrice,
      };
    },
    [accommodation, availability, bookingDates, guestCounts, selectedCoupon],
  );

  const selectionMatchesQuote = useCallback(
    (quoteSnapshot: BookingTransactionSnapshot): boolean => {
      if (!accommodation) return false;
      const couponId = liveQuotedCouponIdRef.current;
      if (couponId === undefined) {
        // A direct v2 reference restored after reload is joined to the exact
        // persisted journal. Inputs are locked and the journal, not a
        // reconstructed client draft, remains checkout authority.
        return accommodation.id === quoteSnapshot.accommodationId;
      }
      return (
        accommodation.id === quoteSnapshot.accommodationId &&
        (bookingDates.checkIn
          ? formatBookingLocalDate(bookingDates.checkIn)
          : "") === quoteSnapshot.checkIn &&
        (bookingDates.checkOut
          ? formatBookingLocalDate(bookingDates.checkOut)
          : "") === quoteSnapshot.checkOut &&
        guestCounts.adultCount === quoteSnapshot.adultCount &&
        guestCounts.childCount === quoteSnapshot.childCount &&
        guestCounts.infantCount === quoteSnapshot.infantCount &&
        guestCounts.petCount === quoteSnapshot.petCount &&
        (selectedCoupon?.id ?? null) === couponId
      );
    },
    [accommodation, bookingDates, guestCounts, selectedCoupon?.id],
  );

  const completeTerminal = useCallback(
    async (
      handle: BookingTransactionHandle,
      terminalSnapshot: BookingTransactionSnapshot,
    ) => {
      setStatus("completing");
      const completed = await onTerminalReservation(
        handle,
        terminalSnapshot,
        routeLease,
      );
      if (!completed && routeLease.isCurrent()) {
        setStatus("terminal-ready");
        onError("예약 내역을 갱신하지 못했습니다. 다시 시도해주세요.");
      }
    },
    [onError, onTerminalReservation, routeLease],
  );

  const checkout = useCallback(
    async (
      handle: BookingTransactionHandle,
      quoteSnapshot: BookingTransactionSnapshot,
    ) => {
      if (!selectionMatchesQuote(quoteSnapshot)) {
        onError("예약 조건이 변경되었습니다. 조건을 다시 선택해주세요.");
        return;
      }

      setStatus("checking-out");
      onError(null);
      const pending = workflow.checkout({ handle, routeLease });
      activeCommandRef.current = pending;
      try {
        const result = await pending;
        if (activeCommandRef.current !== pending || !routeLease.isCurrent()) {
          return;
        }
        switch (result.status) {
          case "payment-ready":
            // Checkout changes the durable journal locator from accommodation
            // to reservation. Publish that exact handle before any route or
            // terminal side effect so a crash can rejoin the written journal.
            currentHandleRef.current = result.handle;
            if (!onFlowHandleChange(result.handle)) {
              setStatus("locked");
              onError(activePaymentMessage);
              return;
            }
            setSnapshot(result.snapshot);
            onOpenPayment(result.handle, result.snapshot);
            return;
          case "complimentary":
          case "reservation-status":
            currentHandleRef.current = result.handle;
            if (!onFlowHandleChange(result.handle)) {
              setStatus("locked");
              onError(activePaymentMessage);
              return;
            }
            setSnapshot(result.snapshot);
            await completeTerminal(result.handle, result.snapshot);
            return;
          case "current":
            currentHandleRef.current = result.handle;
            setSnapshot(result.snapshot);
            if (isTerminalPhase(result.snapshot)) {
              await completeTerminal(result.handle, result.snapshot);
            } else if (
              result.snapshot.reservationUid &&
              (result.snapshot.canPay ||
                result.snapshot.phase === "hold-release-requesting")
            ) {
              onOpenPayment(result.handle, result.snapshot);
            } else {
              setStatus("quoted");
            }
            return;
          case "unsupported-payment": {
            const abandoned = workflow.abandonUnheld({
              handle: result.handle,
              routeLease,
            });
            if (abandoned.status === "abandoned") {
              if (onFlowHandleChange(null)) {
                currentHandleRef.current = null;
                setSnapshot(null);
                setStatus("idle");
              } else {
                setStatus("locked");
              }
            } else {
              setStatus("locked");
            }
            onError(
              result.reason === "currency"
                ? "현재 이 통화는 결제할 수 없습니다."
                : "카드 결제 가능한 금액 범위를 벗어났습니다.",
            );
            return;
          }
          case "conflict":
            setStatus("locked");
            onError(activePaymentMessage);
            onOpenTrips();
            return;
          case "definitive-failure":
            if (onFlowHandleChange(null)) {
              currentHandleRef.current = null;
              setSnapshot(null);
              setStatus("idle");
              onError(failureMessage(result.failure.code));
            } else {
              setStatus("locked");
              onError(activePaymentMessage);
            }
            return;
          case "retryable-error":
            setStatus("quoted");
            onError(failureMessage(result.failure.code));
            return;
          case "auth-required":
            setStatus("idle");
            onError("다시 로그인한 뒤 예약을 계속해주세요.");
            return;
          case "blocked":
            setStatus("locked");
            onError(activePaymentMessage);
            return;
          case "missing":
            setStatus("locked");
            onError("예약 견적을 찾을 수 없습니다.");
            return;
          case "busy":
          case "stale":
          case "locked":
            return;
        }
      } finally {
        if (activeCommandRef.current === pending)
          activeCommandRef.current = null;
      }
    },
    [
      completeTerminal,
      onError,
      onFlowHandleChange,
      onOpenPayment,
      onOpenTrips,
      routeLease,
      selectionMatchesQuote,
      workflow,
    ],
  );

  const startReservation = useCallback(
    async (
      resumeIntent?: BookingTransactionStartIntent,
      resumedCoupon?: AccommodationCoupon | null,
    ) => {
      if (activeCommandRef.current || status === "locked") return;

      const handle = currentHandleRef.current;
      if (handle && snapshot) {
        if (isTerminalPhase(snapshot)) {
          await completeTerminal(handle, snapshot);
        } else if (snapshot.canCheckout) {
          await checkout(handle, snapshot);
        } else if (
          snapshot.reservationUid &&
          (snapshot.canPay || snapshot.phase === "hold-release-requesting")
        ) {
          onOpenPayment(handle, snapshot);
        }
        return;
      }

      if (isRecoveryBlocked) {
        setStatus("locked");
        onError(activePaymentMessage);
        return;
      }
      if (!accommodation || !availability) {
        onError("예약 가능한 날짜를 다시 불러와주세요.");
        return;
      }

      const draft = currentIntent(resumeIntent, resumedCoupon);
      if (!draft) return;
      const appliedCoupon = toAppliedCoupon(draft.coupon, draft.totalPrice);
      setStatus("quoting");
      onError(null);
      const pending = workflow.quote({
        accommodation: {
          id: accommodation.id,
          maxOccupancy: accommodation.policy.maxOccupancy,
          maxInfants: accommodation.policy.infantOccupancy,
          maxPets: accommodation.policy.petOccupancy,
        },
        availability: {
          accommodationId: availability.accommodationId,
          bookingWindowStartInclusive: availability.bookingWindowStartInclusive,
          bookingWindowEndExclusive: availability.bookingWindowEndExclusive,
          unavailableRanges: availability.unavailableRanges,
        },
        appliedCoupon,
        intent: draft.intent,
        publishPreparedHandle: (preparedHandle) => {
          currentHandleRef.current = preparedHandle;
          const published = onFlowHandleChange(preparedHandle);
          if (!published) currentHandleRef.current = null;
          return published;
        },
        routeLease,
      });
      activeCommandRef.current = pending;

      try {
        const result = await pending;
        if (activeCommandRef.current !== pending || !routeLease.isCurrent()) {
          return;
        }
        switch (result.status) {
          case "quoted":
            if (
              (!currentHandleRef.current ||
                !isSameHandle(currentHandleRef.current, result.handle)) &&
              !onFlowHandleChange(result.handle)
            ) {
              currentHandleRef.current = null;
              setStatus("locked");
              onError(activePaymentMessage);
              return;
            }
            liveQuotedCouponIdRef.current = draft.intent.couponId;
            currentHandleRef.current = result.handle;
            setSnapshot(result.snapshot);
            setStatus("quoted");
            return;
          case "auth-required":
            setStatus("idle");
            requestAuthentication(result.intent);
            return;
          case "invalid":
            setStatus("idle");
            onError(result.error.message);
            return;
          case "definitive-failure":
          case "retryable-error":
            if (onFlowHandleChange(null)) {
              currentHandleRef.current = null;
              setStatus("idle");
              onError(failureMessage(result.failure.code));
            } else {
              setStatus("locked");
              onError(activePaymentMessage);
            }
            return;
          case "blocked":
            setStatus("locked");
            onError(activePaymentMessage);
            return;
          case "busy":
          case "stale":
          case "locked":
            return;
        }
      } finally {
        if (activeCommandRef.current === pending)
          activeCommandRef.current = null;
      }
    },
    [
      accommodation,
      availability,
      checkout,
      completeTerminal,
      currentIntent,
      isRecoveryBlocked,
      onError,
      onFlowHandleChange,
      onOpenPayment,
      requestAuthentication,
      routeLease,
      snapshot,
      status,
      workflow,
    ],
  );

  const abandonQuote = useCallback((): boolean => {
    const handle = currentHandleRef.current;
    if (!handle || !snapshot || activeCommandRef.current) return false;
    const result = workflow.abandonUnheld({ handle, routeLease });
    if (result.status !== "abandoned") {
      onError(activePaymentMessage);
      return false;
    }

    if (!onFlowHandleChange(null)) {
      setStatus("locked");
      onError(activePaymentMessage);
      return false;
    }

    currentHandleRef.current = null;
    liveQuotedCouponIdRef.current = undefined;
    setSnapshot(null);
    setStatus("idle");
    onError(null);
    return true;
  }, [onError, onFlowHandleChange, routeLease, snapshot, workflow]);

  return {
    abandonQuote,
    isReservationLocked: status === "locked",
    isReserving:
      status === "quoting" ||
      status === "checking-out" ||
      status === "completing",
    quoteSnapshot: snapshot,
    reservationStatus: status,
    selectionLocked: snapshot !== null,
    startReservation,
  };
};
