import React, { useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { usePaymentConfirmation } from "../../features/reservations";
import { routeTo } from "../../routes/paths";
import styles from "./PaymentSuccess.module.css";

const PaymentSuccess: React.FC = () => {
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");
  const { result } = usePaymentConfirmation({
    amount,
    enabled: Boolean(reservationUid),
    orderId,
    paymentKey,
  });

  useEffect(() => {
    if (!reservationUid) {
      navigate(routeTo.profile());
      return;
    }

    if (!result) return;

    if (result.status === "failed") {
      console.error("결제 확인 중 오류:", result.error);
    }

    navigate(routeTo.reservationDetail(reservationUid));
  }, [reservationUid, navigate, result]);

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
