import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { clearReservationCheckoutStateByReservationUid } from "../../features/reservations/lib/reservationCheckoutState";
import { routeTo } from "../../routes/paths";
import styles from "./PaymentFail.module.css";

const PaymentFail: React.FC = () => {
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!reservationUid) return;

    clearReservationCheckoutStateByReservationUid(reservationUid);
  }, [reservationUid]);

  return (
    <>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.errorIcon}>❌</div>
          <h1 className={styles.title}>결제에 실패했습니다</h1>
          <p className={styles.message}>
            결제 처리 중 문제가 발생했습니다. 다시 시도해주세요.
          </p>
          <div className={styles.actions}>
            <button className={styles.button} onClick={() => navigate(routeTo.profile())}>
              프로필로 이동
            </button>
            {reservationUid && (
              <button
                className={styles.buttonSecondary}
                onClick={() => navigate(routeTo.reservationDetail(reservationUid))}
              >
                예약 상세 보기
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentFail;


