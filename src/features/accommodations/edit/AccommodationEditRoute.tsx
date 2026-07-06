import React, { useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { routeTo } from "../../../routes/paths";
import { AccommodationEditScreen } from "./components/AccommodationEditScreen";
import { useAccommodationEditController } from "./hooks/useAccommodationEditController";

export interface AccommodationEditRouteProps {
  accommodationId?: string;
  isNewDraft?: boolean;
  onNavigateToHostProfile?: () => void;
}

type AccommodationEditRouteContentProps = Required<
  Omit<AccommodationEditRouteProps, "accommodationId">
> &
  Pick<AccommodationEditRouteProps, "accommodationId">;

const AccommodationEditRouteContent: React.FC<
  AccommodationEditRouteContentProps
> = ({
  accommodationId,
  isNewDraft,
  onNavigateToHostProfile,
}) => {
  const { state, actions } = useAccommodationEditController({
    accommodationId,
    isNewDraft,
    onNavigateToHostProfile,
  });

  return <AccommodationEditScreen state={state} actions={actions} />;
};

const AccommodationEditRouteWithRouter: React.FC<
  AccommodationEditRouteProps
> = (props) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const navigateToHostProfile = useCallback(() => {
    navigate(routeTo.profile({ mode: "host" }));
  }, [navigate]);

  return (
    <AccommodationEditRouteContent
      accommodationId={props.accommodationId ?? id}
      isNewDraft={props.isNewDraft ?? searchParams.get("mode") === "create"}
      onNavigateToHostProfile={
        props.onNavigateToHostProfile ?? navigateToHostProfile
      }
    />
  );
};

export const AccommodationEditRoute: React.FC<AccommodationEditRouteProps> = (
  props,
) => {
  if (
    props.isNewDraft !== undefined &&
    props.onNavigateToHostProfile !== undefined
  ) {
    return (
      <AccommodationEditRouteContent
        accommodationId={props.accommodationId}
        isNewDraft={props.isNewDraft}
        onNavigateToHostProfile={props.onNavigateToHostProfile}
      />
    );
  }

  return <AccommodationEditRouteWithRouter {...props} />;
};
