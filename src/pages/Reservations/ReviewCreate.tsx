import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ReviewCreateRoute } from "../../features/reviews";

const ReviewCreate: React.FC = () => {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();

  return (
    <ReviewCreateRoute
      navigate={navigate}
      reservationUid={reservationUid}
    />
  );
};

export default ReviewCreate;
