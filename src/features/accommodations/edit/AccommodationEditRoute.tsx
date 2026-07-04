import React from "react";
import { AccommodationEditScreen } from "./components/AccommodationEditScreen";
import { useAccommodationEditController } from "./hooks/useAccommodationEditController";

export interface AccommodationEditRouteProps {
  accommodationId?: string;
  isNewDraft: boolean;
  onNavigateToHostProfile: () => void;
}

export const AccommodationEditRoute: React.FC<AccommodationEditRouteProps> = ({
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
