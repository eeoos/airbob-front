import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HostReservationDetailRoute } from "../../../features/reservations";

const HostReservationDetail: React.FC = () => {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();

  return (
    <HostReservationDetailRoute
      navigate={navigate}
      reservationUid={reservationUid}
    />
  );
};

export default HostReservationDetail;
