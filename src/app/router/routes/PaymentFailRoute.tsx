import { useNavigate, useParams } from "react-router-dom";
import { PaymentResultScreen } from "../../../screens/payment-result/PaymentResultScreen";
import { usePaymentCallbackFailureClaim } from "../PaymentCallbackCredentialBoundary";
import { routeTo } from "../paths";

const failureMessage = (
  claim: ReturnType<typeof usePaymentCallbackFailureClaim>,
): string => {
  if (claim.status !== "internal") {
    return "결제 제공자가 결제를 완료하지 못했습니다. 예약 상세에서 현재 상태를 확인해주세요.";
  }
  return claim.reason === "confirm-failed"
    ? "결제 승인 결과를 확인하지 못했습니다. 예약 상세에서 현재 상태를 확인해주세요."
    : "결제 결과 정보가 올바르지 않습니다. 예약 상세에서 현재 상태를 확인해주세요.";
};

/**
 * Toss failure-return data is presentation-only. This route intentionally has
 * no journal, storage, payment API, or query-cache dependency and cannot turn
 * provider query fields (including orderId) into payment authority.
 */
function PaymentFailRoute() {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const failureClaim = usePaymentCallbackFailureClaim();

  return (
    <PaymentResultScreen
      mode="failure"
      statusMessage={failureMessage(failureClaim)}
      onOpenProfile={() =>
        navigate(routeTo.profile(), { replace: true, state: null })
      }
      {...(reservationUid
        ? {
            onOpenReservation: () =>
              navigate(routeTo.reservationDetail(reservationUid), {
                replace: true,
                state: null,
              }),
          }
        : {})}
    />
  );
}

export default PaymentFailRoute;
