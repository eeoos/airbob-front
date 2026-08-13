import React from "react";
import { Button, ErrorState, LoadingState } from "../../../../shared/ui";
import { AccommodationEditDetailState } from "../hooks/useAccommodationEditDetail";
import { AccommodationEditStep } from "../hooks/useAccommodationEditForm";
import { AccommodationEditFormData } from "../lib/accommodationEditMapper";
import { AccommodationEditImageItem } from "../lib/imageItems";
import { EditStepContent } from "./EditStepContent";
import { EditWizardActionBar } from "./EditWizardActionBar";
import { EditWizardDialogs } from "./EditWizardDialogs";
import styles from "./EditWizardLayout.module.css";
import { EditWizardNavigation } from "./EditWizardNavigation";
import { EditWizardSidebar } from "./EditWizardSidebar";

type Step = AccommodationEditStep;

type NestedFormFields = {
  addressInfo: AccommodationEditFormData["addressInfo"];
  occupancyPolicyInfo: AccommodationEditFormData["occupancyPolicyInfo"];
};

export interface AccommodationEditScreenState {
  currentStep: Step;
  detailState: AccommodationEditDetailState;
  isEditorReady: boolean;
  isSaving: boolean;
  isDeletingImage: boolean;
  uploadProgress: number;
  formData: AccommodationEditFormData;
  selectedAmenities: Set<string>;
  imageItems: AccommodationEditImageItem[];
  draggedIndex: number | null;
  dragOverIndex: number | null;
  openTimePicker: "checkIn" | "checkOut" | null;
  isTypeModalOpen: boolean;
  isAmenityModalOpen: boolean;
  showDetailAddressConfirm: boolean;
  error: string | null;
  canProceedToNext: boolean;
}

export interface AccommodationEditScreenActions {
  isStepCompleted: (step: Step) => boolean;
  isStepClickable: (step: Step) => boolean;
  setFormData: React.Dispatch<React.SetStateAction<AccommodationEditFormData>>;
  setSelectedAmenities: React.Dispatch<React.SetStateAction<Set<string>>>;
  setOpenTimePicker: React.Dispatch<
    React.SetStateAction<"checkIn" | "checkOut" | null>
  >;
  onAddressSearch: () => void;
  onDetailChange: (value: string) => void;
  onImageSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onImageRemove: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOverItem: (event: React.DragEvent, index: number) => void;
  onDragEnd: (event: React.DragEvent) => void;
  onInputChange: <K extends keyof AccommodationEditFormData>(
    field: K,
    value: AccommodationEditFormData[K]
  ) => void;
  onNestedChange: <
    P extends keyof NestedFormFields,
    K extends keyof NestedFormFields[P]
  >(
    parent: P,
    field: K,
    value: NestedFormFields[P][K]
  ) => void;
  onTimeChange: (
    type: "checkIn" | "checkOut",
    hour: number,
    minute: number,
    period: "AM" | "PM"
  ) => void;
  onOpenTypeModal: () => void;
  onCloseTypeModal: () => void;
  onOpenAmenityModal: () => void;
  onCloseAmenityModal: () => void;
  onSaveAndExit: () => void;
  onNext: () => void | Promise<void>;
  onBack: () => void;
  onStepClick: (stepNumber: number) => void;
  onPublishSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCloseDetailAddressConfirm: () => void;
  onConfirmDetailAddress: () => void;
  onRetryDetail: () => void;
  onExitDetailError: () => void;
  onClearError: () => void;
}

export interface AccommodationEditScreenProps {
  state: AccommodationEditScreenState;
  actions: AccommodationEditScreenActions;
}

export const AccommodationEditScreen: React.FC<AccommodationEditScreenProps> = ({
  state,
  actions,
}) => {
  const {
    currentStep,
    isSaving,
    canProceedToNext,
  } = state;
  const {
    isStepCompleted,
    isStepClickable,
    onSaveAndExit,
    onNext,
    onBack,
    onStepClick,
    onPublishSubmit,
  } = actions;

  if (state.detailState.status === "error") {
    return (
      <ErrorState
        title="숙소 정보를 불러오지 못했어요"
        description="다시 시도하거나 호스트 화면으로 돌아가 주세요."
        action={
          <>
            <Button type="button" onClick={actions.onRetryDetail}>
              다시 시도
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={actions.onExitDetailError}
            >
              호스트 화면으로 돌아가기
            </Button>
          </>
        }
      />
    );
  }

  if (state.detailState.status === "loading" || !state.isEditorReady) {
    return <LoadingState title="숙소 정보를 불러오는 중..." />;
  }

  return (
    <>
      <div className={styles.container}>
        <EditWizardActionBar
          isSaving={isSaving}
          onSaveAndExit={onSaveAndExit}
        />

        <div className={styles.content}>
          <EditWizardSidebar
            currentStep={currentStep}
            isInteractionDisabled={isSaving || state.isDeletingImage}
            isStepCompleted={isStepCompleted}
            isStepClickable={isStepClickable}
            onStepClick={onStepClick}
          />

          <div className={styles.mainContent}>
            <form
              onSubmit={currentStep === 5 ? onPublishSubmit : undefined}
              className={styles.form}
            >
              <fieldset
                className={styles.formFieldset}
                disabled={isSaving || state.isDeletingImage}
              >
                <EditStepContent state={state} actions={actions} />

                <EditWizardNavigation
                  currentStep={currentStep}
                  isSaving={isSaving}
                  canProceedToNext={canProceedToNext}
                  onBack={onBack}
                  onNext={onNext}
                />
              </fieldset>
            </form>
          </div>
        </div>
      </div>

      <EditWizardDialogs state={state} actions={actions} />
    </>
  );
};
