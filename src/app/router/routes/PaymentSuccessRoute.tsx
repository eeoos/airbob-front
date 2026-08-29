import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  PaymentSuccessRoute as LegacyPaymentSuccessRoute,
} from "../../../features/reservations/PaymentSuccessRoute";

export function PaymentSuccessRoute() {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const [searchParams] = useSearchParams();

  return (
    <LegacyPaymentSuccessRoute
      navigate={navigate}
      reservationUid={reservationUid}
      searchParams={searchParams}
    />
  );
}

export default PaymentSuccessRoute;
