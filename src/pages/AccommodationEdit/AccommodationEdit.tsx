import React, { useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AccommodationEditRoute } from "../../features/accommodations/edit";
import { routeTo } from "../../routes/paths";

const AccommodationEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const navigateToHostProfile = useCallback(() => {
    navigate(routeTo.profile({ mode: "host" }));
  }, [navigate]);

  return (
    <AccommodationEditRoute
      accommodationId={id}
      isNewDraft={searchParams.get("mode") === "create"}
      onNavigateToHostProfile={navigateToHostProfile}
    />
  );
};

export default AccommodationEdit;
