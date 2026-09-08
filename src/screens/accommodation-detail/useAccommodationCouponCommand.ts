import { useCallback, useEffect, useRef, useState } from "react";
import {
  accommodationCouponApi,
  isAccommodationCouponApplicable,
  type AccommodationCoupon,
  type AccommodationDetailQueryOptions,
  type AccommodationMemberCouponCollection,
} from "../../features/accommodations/detail/public";
import type {
  BookingTransactionRouteLease,
  BookingTransactionSessionPort,
} from "../../workflows/booking-payment/transaction/booking";
import {
  getAccommodationErrorCode,
  toAccommodationErrorMessage,
} from "./accommodationDetailErrors";

interface UseAccommodationCouponCommandOptions {
  readonly accommodationId: number | null;
  readonly isAuthenticated: boolean;
  readonly onError: (message: string | null) => void;
  readonly requestAuthentication: (couponId: number) => void;
  readonly routeLease: BookingTransactionRouteLease;
  readonly session: BookingTransactionSessionPort;
  readonly scope: AccommodationDetailQueryOptions["scope"];
  readonly totalPrice: number;
  readonly refreshMyCoupons: () => Promise<AccommodationMemberCouponCollection>;
  readonly refreshCampaigns: () => void;
}

export const useAccommodationCouponCommand = ({
  accommodationId,
  isAuthenticated,
  onError,
  requestAuthentication,
  routeLease,
  session,
  scope,
  totalPrice,
  refreshMyCoupons,
  refreshCampaigns,
}: UseAccommodationCouponCommandOptions) => {
  const [issuingCouponId, setIssuingCouponId] = useState<number | null>(null);
  const [selection, setSelection] = useState<{
    id: number;
    scope: AccommodationDetailQueryOptions["scope"];
  } | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const selectedCouponId =
    isAuthenticated &&
    selection?.scope.subject === scope.subject &&
    selection.scope.epoch === scope.epoch
      ? selection.id
      : null;

  useEffect(() => {
    const controller = activeControllerRef.current;
    activeControllerRef.current = null;
    controller?.abort();
    setIssuingCouponId(null);
    setSelection(null);
  }, [routeLease, scope.subject, scope.epoch]);

  useEffect(() => () => activeControllerRef.current?.abort(), []);

  const clearSelectedCoupon = useCallback(() => setSelection(null), []);

  const issueCoupon = useCallback(
    async (coupon: AccommodationCoupon, resumed = false) => {
      if (
        accommodationId === null ||
        coupon.id < 1 ||
        activeControllerRef.current ||
        !routeLease.isCurrent() ||
        (coupon.kind === "campaign" && coupon.issuanceStatus !== "OPEN") ||
        (coupon.kind === "owned" &&
          !isAccommodationCouponApplicable(coupon, totalPrice))
      )
        return;

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
        !controller.signal.aborted &&
        routeLease.isCurrent() &&
        session.isCurrentSession(capturedSession);
      const clearMatchingSelection = () =>
        setSelection((current) => (current?.id === coupon.id ? null : current));

      try {
        if (coupon.kind === "campaign") {
          try {
            await accommodationCouponApi.issue(coupon.id, {
              signal: controller.signal,
            });
          } catch (error) {
            if (getAccommodationErrorCode(error) !== "CP003") throw error;
          } finally {
            if (isCurrent()) refreshCampaigns();
          }
        }
        if (!isCurrent()) return;
        // Issuance (including CP003) proves ownership only; reload the server's
        // use status before applying. Owned coupons never issue another POST.
        const owned = await refreshMyCoupons();
        if (!isCurrent()) return;
        const currentCoupon = owned.coupons.find(
          (item) => item.id === coupon.id,
        );
        if (
          currentCoupon &&
          isAccommodationCouponApplicable(currentCoupon, totalPrice)
        ) {
          setSelection({ id: coupon.id, scope });
        } else {
          clearMatchingSelection();
          onError(
            "쿠폰은 보유 목록에서 확인할 수 있습니다. 현재 예약에 적용할 수 있는 상태와 금액인지 확인해주세요.",
          );
        }
      } catch (error) {
        if (!isCurrent()) return;
        clearMatchingSelection();
        onError(toAccommodationErrorMessage(error));
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null;
          setIssuingCouponId(null);
        }
      }
    },
    [
      accommodationId,
      onError,
      requestAuthentication,
      routeLease,
      session,
      scope,
      totalPrice,
      refreshMyCoupons,
      refreshCampaigns,
    ],
  );

  return {
    issueCoupon,
    issuingCouponId,
    selectedCouponId,
    clearSelectedCoupon,
  };
};
