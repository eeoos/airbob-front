import { useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AccommodationEditRoute as LegacyAccommodationEditRoute,
} from "../../../features/accommodations/edit/AccommodationEditRoute";
import {
  isAccommodationEditDraftCreationState,
  routeTo,
} from "../paths";

export function AccommodationEditRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const navigateToHostProfile = useCallback(() => {
    navigate(routeTo.profile({ mode: "host" }));
  }, [navigate]);

  return (
    <LegacyAccommodationEditRoute
      accommodationId={id}
      isNewDraft={isAccommodationEditDraftCreationState(location.state, id)}
      onNavigateToHostProfile={navigateToHostProfile}
    />
  );
}

export default AccommodationEditRoute;
