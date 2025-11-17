import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { paymentApi, reservationApi } from "../../api";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import styles from "./PaymentSuccess.module.css";

const PaymentSuccess: React.FC = () => {
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { error, handleError, clearError } = useApiError();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    // 인증 상태가 로드될 때까지 대기
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      // 인증되지 않은 경우 홈으로 이동
      navigate("/");
      return;
    }

    if (!reservationUid) {
      navigate("/profile");
      return;
    }

    const processPayment = async () => {
      const paymentKey = searchParams.get("paymentKey");
      const orderId = searchParams.get("orderId");
      const amount = searchParams.get("amount");

      if (!paymentKey || !orderId || !amount) {
        // 결제 정보가 없어도 예약 상세 페이지로 이동 (가상계좌 등 비동기 결제의 경우)
        navigate(`/reservations/${reservationUid}`);
        return;
      }

      try {
        // 결제 확인
        await paymentApi.confirm({
          payment_key: paymentKey,
          order_id: orderId,
          amount: parseInt(amount),
        });

        // 결제 확인 완료 후 예약 상세 페이지로 이동
        navigate(`/reservations/${reservationUid}`);
      } catch (err) {
        // 결제 확인 실패해도 예약 상세 페이지로 이동 (상태 확인 가능)
        console.error("결제 확인 중 오류:", err);
        navigate(`/reservations/${reservationUid}`);
      }
    };

    processPayment();
  }, [reservationUid, searchParams, isAuthenticated, isAuthLoading, navigate]);

  // 로딩 화면 표시 (리다이렉트 중)
  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.spinner}></div>
          <h1 className={styles.title}>결제를 처리하고 있습니다...</h1>
          <p className={styles.message}>예약 상세 페이지로 이동합니다.</p>
        </div>
      </div>
    </MainLayout>
  );
};

export default PaymentSuccess;



