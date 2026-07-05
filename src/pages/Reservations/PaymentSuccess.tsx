import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PaymentSuccessRoute } from "../../features/reservations";

const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const [searchParams] = useSearchParams();

  return (
    <PaymentSuccessRoute
      navigate={navigate}
      reservationUid={reservationUid}
      searchParams={searchParams}
    />
  );
};

export default PaymentSuccess;
