import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  PaymentFailRoute as LegacyPaymentFailRoute,
} from "../../../features/reservations/PaymentFailRoute";
import { paymentCodec } from "../codecs/paymentCodec";

export function PaymentFailRoute() {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const [searchParams] = useSearchParams();

  return (
    <LegacyPaymentFailRoute
      navigate={navigate}
      reason={paymentCodec.parseFailReason(searchParams.get("reason"))}
      reservationUid={reservationUid}
      searchParams={searchParams}
    />
  );
}

export default PaymentFailRoute;
