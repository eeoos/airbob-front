import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ReservationConfirmRoute } from "../../features/reservations";

const ReservationConfirm: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return (
    <ReservationConfirmRoute
      accommodationId={id}
      locationState={location.state}
      navigate={navigate}
    />
  );
};

export default ReservationConfirm;
