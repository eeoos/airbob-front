import React, { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import { routeTo } from "../../routes/paths";
import { usePaymentConfirmation } from "./hooks/usePaymentConfirmation";
import { clearReservationCheckoutStateByReservationUid } from "./lib/reservationCheckoutState";
import { parseTossSuccessRouteState } from "./lib/paymentRouteState";
import styles from "./PaymentSuccessRoute.module.css";

interface PaymentSuccessRouteProps {
  navigate: NavigateFunction;
  reservationUid?: string;
  searchParams: URLSearchParams;
}

export const PaymentSuccessRoute: React.FC<PaymentSuccessRouteProps> = ({
  navigate,
  reservationUid,
  searchParams,
}) => {
  const tossSuccessRouteState = parseTossSuccessRouteState(
    reservationUid,
    searchParams,
  );
  const isPaymentQueryIncomplete = tossSuccessRouteState.status === "invalid";
  const paymentKey =
    tossSuccessRouteState.status === "valid"
      ? tossSuccessRouteState.paymentKey
      : null;
  const orderId =
    tossSuccessRouteState.status === "valid" ? tossSuccessRouteState.orderId : null;
  const amount =
    tossSuccessRouteState.status === "valid" ? tossSuccessRouteState.amount : null;

  const { result: confirmationResult } = usePaymentConfirmation({
    amount,
    enabled: Boolean(reservationUid) && !isPaymentQueryIncomplete,
    orderId,
    paymentKey,
  });

  useEffect(() => {
    const clearCheckoutState = (reservationUidToClear: string) => {
      try {
        clearReservationCheckoutStateByReservationUid(reservationUidToClear);
      } catch {
        // Cleanup is best-effort and must not block the payment result redirect.
      }
    };

    if (!reservationUid) {
      navigate(routeTo.profile(), { replace: true });
      return;
    }

    const result = isPaymentQueryIncomplete
      ? ({ error: null, status: "skipped" } as const)
      : confirmationResult;

    if (!result) return;

    if (result.status === "failed") {
      if (result.retryable !== true) {
        clearCheckoutState(reservationUid);
      }
      navigate(routeTo.paymentFail(reservationUid, { reason: "confirm-failed" }), {
        replace: true,
      });
      return;
    }

    clearCheckoutState(reservationUid);

    if (result.status === "confirmed") {
      navigate(routeTo.reservationDetail(reservationUid), { replace: true });
      return;
    }

    navigate(routeTo.paymentFail(reservationUid, { reason: "invalid-callback" }), {
      replace: true,
    });
  }, [confirmationResult, isPaymentQueryIncomplete, navigate, reservationUid]);

  return (
    <>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.spinner}></div>
          <h1 className={styles.title}>결제를 처리하고 있습니다...</h1>
          <p className={styles.message}>예약 상세 페이지로 이동합니다.</p>
        </div>
      </div>
    </>
  );
};
