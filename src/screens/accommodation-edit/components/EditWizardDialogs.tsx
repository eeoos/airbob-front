import React from "react";
import { ToastHost } from "../../../shared/ui";
import type {
  AccommodationEditScreenActions,
  AccommodationEditScreenState,
} from "../editorViewContract";
import { AccommodationTypeModal } from "./AccommodationTypeModal";
import { AmenityModal } from "./AmenityModal";
import { DetailAddressConfirmModal } from "./DetailAddressConfirmModal";

type EditWizardDialogsState = Pick<
  AccommodationEditScreenState,
  | "error"
  | "formData"
  | "isAmenityModalOpen"
  | "isTypeModalOpen"
  | "recoveryState"
  | "showDetailAddressConfirm"
>;

type EditWizardDialogsActions = Pick<
  AccommodationEditScreenActions,
  | "onClearError"
  | "onCloseAmenityModal"
  | "onCloseDetailAddressConfirm"
  | "onCloseTypeModal"
  | "onConfirmDetailAddress"
  | "onInputChange"
  | "onRetryRecovery"
  | "setFormData"
>;

interface EditWizardDialogsProps {
  state: EditWizardDialogsState;
  actions: EditWizardDialogsActions;
}

export const EditWizardDialogs: React.FC<EditWizardDialogsProps> = ({
  state,
  actions,
}) => (
  <>
    {state.error && (
      <ToastHost
        closeLabel="오류 닫기"
        dismissible={state.recoveryState === "none"}
        message={state.error}
        onClose={actions.onClearError}
        {...(state.recoveryState === "none"
          ? {}
          : {
              action: {
                label: "복구 다시 시도",
                onClick: actions.onRetryRecovery,
              },
            })}
      />
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
        setFormData={actions.setFormData}
        onClose={actions.onCloseAmenityModal}
      />
    )}
  </>
);
