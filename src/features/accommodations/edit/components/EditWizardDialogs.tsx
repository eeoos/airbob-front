import React from "react";
import { ErrorToast } from "../../../../components/ErrorToast";
import type {
  AccommodationEditScreenActions,
  AccommodationEditScreenState,
} from "./AccommodationEditScreen";
import { AccommodationTypeModal } from "./AccommodationTypeModal";
import { AmenityModal } from "./AmenityModal";
import { DetailAddressConfirmModal } from "./DetailAddressConfirmModal";

interface EditWizardDialogsProps {
  state: AccommodationEditScreenState;
  actions: AccommodationEditScreenActions;
}

export const EditWizardDialogs: React.FC<EditWizardDialogsProps> = ({
  state,
  actions,
}) => (
  <>
    {state.error && (
      <ErrorToast message={state.error} onClose={actions.onClearError} />
    )}

    {state.showDetailAddressConfirm && (
      <DetailAddressConfirmModal
        onClose={actions.onCloseDetailAddressConfirm}
        onConfirm={actions.onConfirmDetailAddress}
      />
    )}

    {state.isTypeModalOpen && (
      <AccommodationTypeModal
        selectedType={state.formData.type}
        onSelect={(type) => actions.onInputChange("type", type)}
        onClose={actions.onCloseTypeModal}
      />
    )}

    {state.isAmenityModalOpen && (
      <AmenityModal
        amenityInfos={state.formData.amenityInfos}
        selectedAmenities={state.selectedAmenities}
        setFormData={actions.setFormData}
        setSelectedAmenities={actions.setSelectedAmenities}
        onClose={actions.onCloseAmenityModal}
      />
    )}
  </>
);
