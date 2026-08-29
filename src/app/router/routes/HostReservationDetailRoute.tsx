import { useNavigate, useParams } from "react-router-dom";
import {
  HostReservationDetailRoute as LegacyHostReservationDetailRoute,
} from "../../../features/reservations/HostReservationDetailRoute";

export function HostReservationDetailRoute() {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();

  return (
    <LegacyHostReservationDetailRoute
      navigate={navigate}
      reservationUid={reservationUid}
    />
  );
}

export default HostReservationDetailRoute;
