import React, { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import { routeTo } from "../../routes/paths";
import type { PaymentFailReason } from "../../routes/routeQueryContracts";
import { clearReservationCheckoutStateByReservationUid } from "./lib/reservationCheckoutState";
import styles from "./PaymentFailRoute.module.css";

interface PaymentFailRouteProps {
  navigate: NavigateFunction;
  reason?: PaymentFailReason;
  reservationUid?: string;
}

export const PaymentFailRoute: React.FC<PaymentFailRouteProps> = ({
  navigate,
  reason,
  reservationUid,
}) => {
  useEffect(() => {
    if (!reservationUid || reason === "confirm-failed") return;

    clearReservationCheckoutStateByReservationUid(reservationUid);
  }, [reason, reservationUid]);

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
            <button
              className={styles.button}
              onClick={() => navigate(routeTo.profile())}
            >
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
