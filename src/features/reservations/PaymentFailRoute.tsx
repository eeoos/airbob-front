import React, { useEffect } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
  type NavigateFunction,
} from "react-router-dom";
import { routeTo } from "../../routes/paths";
import {
  parsePaymentFailReason,
  type PaymentFailReason,
} from "../../routes/routeQueryContracts";
import { Button } from "../../shared/ui";
import { clearReservationCheckoutStateByReservationUid } from "./lib/reservationCheckoutState";
import styles from "./PaymentFailRoute.module.css";

interface PaymentFailRouteProps {
  navigate?: NavigateFunction;
  reason?: PaymentFailReason;
  reservationUid?: string;
}

type PaymentFailRouteContentProps = Required<
  Pick<PaymentFailRouteProps, "navigate">
> &
  Omit<PaymentFailRouteProps, "navigate">;

const PaymentFailRouteContent: React.FC<PaymentFailRouteContentProps> = ({
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
            <Button
              className={styles.button}
              onClick={() => navigate(routeTo.profile())}
            >
              프로필로 이동
            </Button>
            {reservationUid && (
              <Button
                variant="secondary"
                className={styles.buttonSecondary}
                onClick={() => navigate(routeTo.reservationDetail(reservationUid))}
              >
                예약 상세 보기
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const PaymentFailRouteWithRouter: React.FC<PaymentFailRouteProps> = (props) => {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const [searchParams] = useSearchParams();

  return (
    <PaymentFailRouteContent
      navigate={props.navigate ?? navigate}
      reason={props.reason ?? parsePaymentFailReason(searchParams.get("reason"))}
      reservationUid={props.reservationUid ?? reservationUid}
    />
  );
};

export const PaymentFailRoute: React.FC<PaymentFailRouteProps> = (props) => {
  if (props.navigate) {
    return (
      <PaymentFailRouteContent
        navigate={props.navigate}
        reason={props.reason}
        reservationUid={props.reservationUid}
      />
    );
  }

  return <PaymentFailRouteWithRouter {...props} />;
};
