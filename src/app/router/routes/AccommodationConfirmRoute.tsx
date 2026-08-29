import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ReservationConfirmRoute as LegacyReservationConfirmRoute,
} from "../../../features/reservations/ReservationConfirmRoute";

export function AccommodationConfirmRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return (
    <LegacyReservationConfirmRoute
      accommodationId={id}
      locationState={location.state ?? null}
      navigate={navigate}
    />
  );
}

export default AccommodationConfirmRoute;
