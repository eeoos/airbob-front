import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ReservationDetailRoute } from "../../features/reservations";

const ReservationDetail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();

  return (
    <ReservationDetailRoute
      locationState={location.state}
      navigate={navigate}
      reservationUid={reservationUid}
    />
  );
};

export default ReservationDetail;
