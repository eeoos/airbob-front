import React, { useRef } from "react";
import { useOutsideClick } from "../../../shared/ui";
import type {
  AccommodationEditScreenActions,
  AccommodationEditScreenState,
} from "../editorViewContract";
import { InfoStep } from "./InfoStep";
import { LocationStep } from "./LocationStep";
import { PhotosStep } from "./PhotosStep";
import { PublishStep } from "./PublishStep";
import { TimeStep } from "./TimeStep";
import timeStyles from "./TimeStep.module.css";

type EditStepContentState = Pick<
  AccommodationEditScreenState,
  | "currentStep"
  | "draggedIndex"
  | "dragOverIndex"
  | "formData"
  | "imageItems"
  | "isDeletingImage"
  | "isSaving"
  | "openTimePicker"
  | "uploadProgress"
>;

type EditStepContentActions = Pick<
  AccommodationEditScreenActions,
  | "onAddressSearch"
  | "onDetailChange"
  | "onDragEnd"
  | "onDragOver"
  | "onDragOverItem"
  | "onDragStart"
  | "onDrop"
  | "onImageRemove"
  | "onImageSelect"
  | "onInputChange"
  | "onNestedChange"
  | "onOpenAmenityModal"
  | "onOpenTypeModal"
  | "onTimeChange"
  | "resolveImageUrl"
  | "setFormData"
  | "setOpenTimePicker"
>;

interface EditStepContentProps {
  state: EditStepContentState;
  actions: EditStepContentActions;
}

export const EditStepContent: React.FC<EditStepContentProps> = ({
  state,
  actions,
}) => {
  const timePickerBoundaryRef = useRef<{
    contains: (target: Node) => boolean;
  } | null>(null);

  timePickerBoundaryRef.current = {
    contains: (target: Node) =>
      target instanceof Element &&
      Boolean(target.closest(`.${timeStyles.timeInputContainer}`)),
  };

  useOutsideClick(
    timePickerBoundaryRef,
    () => actions.setOpenTimePicker(null),
    Boolean(state.openTimePicker)
  );

  switch (state.currentStep) {
    case 1:
      return (
        <LocationStep
          addressInfo={state.formData.addressInfo}
          onAddressSearch={actions.onAddressSearch}
          onDetailChange={actions.onDetailChange}
        />
      );

    case 2:
      return (
        <PhotosStep
          imageItems={state.imageItems}
          isSaving={state.isSaving}
          isDeletingImage={state.isDeletingImage}
          uploadProgress={state.uploadProgress}
          draggedIndex={state.draggedIndex}
          dragOverIndex={state.dragOverIndex}
          resolveImageUrl={actions.resolveImageUrl}
          onImageSelect={actions.onImageSelect}
          onDrop={actions.onDrop}
          onDragOver={actions.onDragOver}
          onImageRemove={actions.onImageRemove}
          onDragStart={actions.onDragStart}
          onDragOverItem={actions.onDragOverItem}
          onDragEnd={actions.onDragEnd}
        />
      );

    case 3:
      return (
        <InfoStep
          formData={state.formData}
          onInputChange={actions.onInputChange}
          onNestedChange={actions.onNestedChange}
          setFormData={actions.setFormData}
          onOpenTypeModal={actions.onOpenTypeModal}
          onOpenAmenityModal={actions.onOpenAmenityModal}
        />
      );

    case 4:
      return (
        <TimeStep
          checkInTime={state.formData.checkInTime}
          checkOutTime={state.formData.checkOutTime}
          openTimePicker={state.openTimePicker}
          setOpenTimePicker={actions.setOpenTimePicker}
          onTimeChange={actions.onTimeChange}
        />
      );

    case 5:
      return <PublishStep />;

    default:
      return null;
  }
};
