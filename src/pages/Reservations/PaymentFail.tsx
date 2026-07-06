import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PaymentFailRoute } from "../../features/reservations";
import { parsePaymentFailReason } from "../../routes/paths";

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
