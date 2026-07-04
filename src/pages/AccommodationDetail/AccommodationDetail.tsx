import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AccommodationDetailRoute } from "../../features/accommodations";

const AccommodationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  return (
    <AccommodationDetailRoute
      accommodationId={id}
      bookingSearchParams={searchParams}
      setBookingSearchParams={setSearchParams}
      navigate={navigate}
    />
  );
};

export default AccommodationDetail;
