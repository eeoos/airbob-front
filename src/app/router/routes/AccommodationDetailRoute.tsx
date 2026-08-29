import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AccommodationDetailRoute as LegacyAccommodationDetailRoute,
} from "../../../features/accommodations/AccommodationDetailRoute";

export function AccommodationDetailRoute() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [bookingSearchParams, setBookingSearchParams] = useSearchParams();

  return (
    <LegacyAccommodationDetailRoute
      accommodationId={id}
      bookingSearchParams={bookingSearchParams}
      navigate={navigate}
      setBookingSearchParams={setBookingSearchParams}
    />
  );
}

export default AccommodationDetailRoute;
