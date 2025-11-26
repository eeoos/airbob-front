import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { useAuth } from "../../hooks/useAuth";
import styles from "./PaymentFail.module.css";

const PaymentFail: React.FC = () => {
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <MainLayout>
        <div className={styles.container}>
          <div className={styles.content}>로딩 중...</div>
        </div>
      </MainLayout>
    );
  }

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.errorIcon}>❌</div>
          <h1 className={styles.title}>결제에 실패했습니다</h1>
          <p className={styles.message}>
            결제 처리 중 문제가 발생했습니다. 다시 시도해주세요.
          </p>
          <div className={styles.actions}>
            <button className={styles.button} onClick={() => navigate("/profile")}>
              프로필로 이동
            </button>
            {reservationUid && (
              <button
                className={styles.buttonSecondary}
                onClick={() => navigate(`/reservations/${reservationUid}`)}
              >
                예약 상세 보기
              </button>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default PaymentFail;







