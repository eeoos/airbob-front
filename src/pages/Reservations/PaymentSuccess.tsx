import React, { useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { usePaymentConfirmation } from "../../features/reservations";
import { parseTossSuccessRouteState } from "../../features/reservations/lib/paymentRouteState";
import { routeTo } from "../../routes/paths";
import styles from "./PaymentSuccess.module.css";

const PaymentSuccess: React.FC = () => {
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tossSuccessRouteState = parseTossSuccessRouteState(
    reservationUid,
    searchParams
  );
  const isPaymentQueryIncomplete = tossSuccessRouteState.status === "invalid";
  const paymentKey =
    tossSuccessRouteState.status === "valid" ? tossSuccessRouteState.paymentKey : null;
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
    if (!reservationUid) {
      navigate(routeTo.profile());
      return;
    }

    const result = isPaymentQueryIncomplete
      ? ({ error: null, status: "skipped" } as const)
      : confirmationResult;

    if (!result) return;

    if (result.status === "confirmed") {
      navigate(routeTo.reservationDetail(reservationUid));
      return;
    }

    navigate(routeTo.paymentFail(reservationUid));
  }, [confirmationResult, isPaymentQueryIncomplete, reservationUid, navigate]);

  // 로딩 화면 표시 (리다이렉트 중)
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

export default PaymentSuccess;
