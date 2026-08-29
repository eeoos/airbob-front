import { useNavigate, useParams } from "react-router-dom";
import {
  ReviewCreateRoute as LegacyReviewCreateRoute,
} from "../../../features/reviews/ReviewCreateRoute";

export function ReservationReviewRoute() {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();

  return (
    <LegacyReviewCreateRoute
      navigate={navigate}
      reservationUid={reservationUid}
    />
  );
}

export default ReservationReviewRoute;
