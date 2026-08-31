import { useCallback, useEffect, useRef, useState } from "react";
import {
  accommodationCouponApi,
  type AccommodationCoupon,
} from "../../features/accommodations/detail/public";
import type {
  ReservationCreateRouteLease,
  ReservationCreateSessionPort,
} from "../../workflows/booking-payment/reservation-create";
import {
  getAccommodationErrorCode,
  toAccommodationErrorMessage,
} from "./accommodationDetailErrors";

interface UseAccommodationCouponCommandOptions {
  readonly accommodationId: number | null;
  readonly isAuthenticated: boolean;
  readonly onError: (message: string | null) => void;
  readonly requestAuthentication: (couponId: number) => void;
  readonly routeLease: ReservationCreateRouteLease;
  readonly session: ReservationCreateSessionPort;
}

export const useAccommodationCouponCommand = ({
  accommodationId,
  isAuthenticated,
  onError,
  requestAuthentication,
  routeLease,
  session,
}: UseAccommodationCouponCommandOptions) => {
  const [issuingCouponId, setIssuingCouponId] = useState<number | null>(null);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = activeControllerRef.current;
    activeControllerRef.current = null;
    controller?.abort();
    setIssuingCouponId(null);
  }, [routeLease]);

  useEffect(() => () => activeControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!isAuthenticated) {
      setSelectedCouponId(null);
      setIssuingCouponId(null);
    }
  }, [isAuthenticated]);

  const issueCoupon = useCallback(
    async (coupon: AccommodationCoupon, resumed = false) => {
      if (
        accommodationId === null ||
        coupon.id < 1 ||
        activeControllerRef.current
      ) {
        return;
      }

      const capturedSession = session.captureAuthenticatedSession();
      if (!capturedSession) {
        if (!resumed) requestAuthentication(coupon.id);
        return;
      }

      const controller = new AbortController();
      activeControllerRef.current = controller;
      setIssuingCouponId(coupon.id);
      onError(null);
      const isCurrent = () =>
        routeLease.isCurrent() && session.isCurrentSession(capturedSession);

      try {
        await accommodationCouponApi.issue(coupon.id, {
          signal: controller.signal,
        });
        if (isCurrent()) setSelectedCouponId(coupon.id);
      } catch (error) {
        if (!isCurrent()) return;
        if (getAccommodationErrorCode(error) === "CP003") {
          setSelectedCouponId(coupon.id);
        } else {
          onError(toAccommodationErrorMessage(error));
        }
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null;
          setIssuingCouponId(null);
        }
      }
    },
    [accommodationId, onError, requestAuthentication, routeLease, session],
  );

  return {
    issueCoupon,
    issuingCouponId,
    selectedCouponId,
    setSelectedCouponId,
  };
};
