import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PaymentFailRoute } from "../../features/reservations";
import type { PaymentFailReason } from "../../routes/paths";

const parsePaymentFailReason = (
  reason: string | null,
): PaymentFailReason | undefined => {
  if (reason === "confirm-failed" || reason === "invalid-callback") {
    return reason;
  }

  return undefined;
};

const PaymentFail: React.FC = () => {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const [searchParams] = useSearchParams();

  return (
    <PaymentFailRoute
      navigate={navigate}
      reservationUid={reservationUid}
      reason={parsePaymentFailReason(searchParams.get("reason"))}
    />
  );
};

export default PaymentFail;
