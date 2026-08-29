import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ReservationDetailRoute as LegacyReservationDetailRoute,
} from "../../../features/reservations/ReservationDetailRoute";

export function ReservationDetailRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();

  return (
    <LegacyReservationDetailRoute
      locationState={location.state ?? null}
      navigate={navigate}
      reservationUid={reservationUid}
    />
  );
}

export default ReservationDetailRoute;
