import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import {
  ReservationDetailController,
  type HostReservationDetailNavigation,
} from "../../../screens/reservation-detail/public";
import { useSession } from "../../session/useSession";
import { routeTo } from "../paths";

export function HostReservationDetailRoute() {
  const navigate = useNavigate();
  const session = useSession();
  const { reservationUid: routeReservationUid } = useParams<{
    reservationUid: string;
  }>();
  const reservationUid = routeReservationUid?.trim() || null;
  const scope = session.captureAuthenticatedSession();

  useEffect(() => {
    if (reservationUid === null) {
      navigate(routeTo.profile(), { replace: true });
    }
  }, [navigate, reservationUid]);

  const navigation = useMemo<HostReservationDetailNavigation>(
    () => ({
      back: () => navigate(-1),
      openAccommodation: (accommodationId) =>
        navigate(routeTo.accommodationDetail(accommodationId)),
    }),
    [navigate],
  );

  if (
    reservationUid === null ||
    scope === null ||
    !session.isCurrentSession(scope)
  ) {
    return null;
  }

  return (
    <ReservationDetailController
      key={`host:${reservationUid}:${scope.subject}:${scope.epoch}`}
      variant="host"
      navigation={navigation}
      reservationUid={reservationUid}
      resolveImageUrl={resolveImageUrl}
      scope={scope}
    />
  );
}

export default HostReservationDetailRoute;
