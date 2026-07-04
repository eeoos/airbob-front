import React, { useCallback, useState } from "react";
import { useApiError } from "../../../../hooks/useApiError";
import type {
  AccommodationEditScreenActions,
  AccommodationEditScreenState,
} from "../components/AccommodationEditScreen";
import { AccommodationEditAddressInfo } from "../lib/daumAddressMapper";
import {
  AccommodationEditStep,
  useAccommodationEditForm,
} from "./useAccommodationEditForm";
import { useAccommodationEditDetail } from "./useAccommodationEditDetail";
import { useAccommodationEditImageUpload } from "./useAccommodationEditImageUpload";
import { useAccommodationEditImages } from "./useAccommodationEditImages";
import { useAccommodationEditSave } from "./useAccommodationEditSave";
import { useDaumPostcode } from "./useDaumPostcode";

type Step = AccommodationEditStep;

export interface UseAccommodationEditControllerOptions {
  accommodationId?: string;
  isNewDraft: boolean;
  onNavigateToHostProfile: () => void;
}

export interface AccommodationEditController {
  state: AccommodationEditScreenState;
  actions: AccommodationEditScreenActions;
}

export const useAccommodationEditController = ({
  accommodationId,
  isNewDraft,
  onNavigateToHostProfile,
}: UseAccommodationEditControllerOptions): AccommodationEditController => {
  const { error, handleError, clearError } = useApiError();
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isAmenityModalOpen, setIsAmenityModalOpen] = useState(false);

  const {
    formData,
    setFormData,
    initialFormData,
    selectedAmenities,
    setSelectedAmenities,
    openTimePicker,
    setOpenTimePicker,
    loadAccommodation,
    handleInputChange,
    handleNestedChange,
    handleTimeChange,
    isStepCompleted: isFormStepCompleted,
    canProceedToNext: canProceedToNextStep,
  } = useAccommodationEditForm();

  const {
    imageItems,
    initialImageItems,
    draggedIndex,
    dragOverIndex,
    loadImages,
    handleImageSelect,
    handleDrop,
    handleDragOver,
    handleImageRemove,
    handleDragStart,
    handleDragOverItem,
    handleDragEnd,
    applyUploadedImages,
    getPendingFiles,
  } = useAccommodationEditImages({
    accommodationId,
    onError: handleError,
  });

  const {
    showDetailAddressConfirm,
    requestDetailAddressConfirm,
    closeDetailAddressConfirm,
    confirmDetailAddress,
    handleSaveAndExit,
    handlePublish,
    saveStepData,
  } = useAccommodationEditSave({
    accommodationId,
    currentStep,
    isNewDraft,
    formData,
    initialFormData,
    imageItems,
    initialImageItems,
    clearError,
    handleError,
    setIsSaving,
    navigateToHostProfile: onNavigateToHostProfile,
  });

  const handleAddressSelected = useCallback(
    (addressInfo: AccommodationEditAddressInfo) => {
      setFormData((prev) => ({
        ...prev,
        addressInfo,
      }));
    },
    [setFormData]
  );

  const { openAddressSearch: handleAddressSearch } = useDaumPostcode({
    onAddressSelected: handleAddressSelected,
  });

  useAccommodationEditDetail({
    accommodationId,
    isNewDraft,
    loadAccommodation,
    loadImages,
    handleError,
  });

  const { uploadPendingImages } = useAccommodationEditImageUpload({
    accommodationId,
    applyUploadedImages,
    clearError,
    getPendingFiles,
    handleError,
    setIsSaving,
    setUploadProgress,
  });

  const isStepCompleted = (step: Step): boolean =>
    isFormStepCompleted(step, {
      imageCount: imageItems.length,
      isNewDraft,
    });

  const canProceedToNext = (): boolean =>
    canProceedToNextStep(currentStep, {
      imageCount: imageItems.length,
      isNewDraft,
    });

  const handleNext = async () => {
    if (currentStep === 1) {
      const hasDetailAddress =
        formData.addressInfo.detail && formData.addressInfo.detail.trim() !== "";
      if (!hasDetailAddress) {
        requestDetailAddressConfirm(() => {
          if (currentStep < 5) {
            setCurrentStep((prev) => (prev + 1) as Step);
          }
        });
        return;
      }
    }

    if (currentStep === 2) {
      const uploaded = await uploadPendingImages();
      if (!uploaded) return;
    }

    if (currentStep === 4 && accommodationId) {
      const saved = await saveStepData();
      if (!saved) return;
      setCurrentStep((prev) => (prev + 1) as Step);
      return;
    }

    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const publishAfterUploadingPendingImages = useCallback(async () => {
    const uploaded = await uploadPendingImages();
    if (!uploaded) return;

    await handlePublish();
  }, [handlePublish, uploadPendingImages]);

  const handlePublishSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (currentStep !== 5) return;

      const hasDetailAddress =
        formData.addressInfo.detail && formData.addressInfo.detail.trim() !== "";
      if (!hasDetailAddress) {
        requestDetailAddressConfirm(() => {
          void publishAfterUploadingPendingImages();
        });
        return;
      }

      await publishAfterUploadingPendingImages();
    },
    [
      currentStep,
      formData.addressInfo.detail,
      publishAfterUploadingPendingImages,
      requestDetailAddressConfirm,
    ]
  );

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const canNavigateToStep = (targetStep: Step): boolean => {
    if (isNewDraft) {
      for (let i = 1; i < targetStep; i++) {
        if (!isStepCompleted(i as Step)) {
          return false;
        }
      }
      return true;
    }

    const isCompleted = isStepCompleted(targetStep);
    const isCurrentCompleted = isStepCompleted(currentStep);
    const isNextStep = targetStep === currentStep + 1;
    const isPreviousStep = targetStep < currentStep;

    return isCompleted || (isCurrentCompleted && isNextStep) || isPreviousStep;
  };

  const handleStepClick = (stepNumber: number) => {
    const targetStep = stepNumber as Step;

    if (canNavigateToStep(targetStep)) {
      setCurrentStep(targetStep);
    }
  };

  return {
    state: {
      currentStep,
      isSaving,
      uploadProgress,
      formData,
      selectedAmenities,
      imageItems,
      draggedIndex,
      dragOverIndex,
      openTimePicker,
      isTypeModalOpen,
      isAmenityModalOpen,
      showDetailAddressConfirm,
      error,
      canProceedToNext: canProceedToNext(),
    },
    actions: {
      isStepCompleted,
      isStepClickable: canNavigateToStep,
      setFormData,
      setSelectedAmenities,
      setOpenTimePicker,
      onAddressSearch: handleAddressSearch,
      onDetailChange: (value) =>
        handleNestedChange("addressInfo", "detail", value),
      onImageSelect: handleImageSelect,
      onDrop: handleDrop,
      onDragOver: handleDragOver,
      onImageRemove: handleImageRemove,
      onDragStart: handleDragStart,
      onDragOverItem: handleDragOverItem,
      onDragEnd: handleDragEnd,
      onInputChange: handleInputChange,
      onNestedChange: handleNestedChange,
      onTimeChange: handleTimeChange,
      onOpenTypeModal: () => setIsTypeModalOpen(true),
      onCloseTypeModal: () => setIsTypeModalOpen(false),
      onOpenAmenityModal: () => setIsAmenityModalOpen(true),
      onCloseAmenityModal: () => setIsAmenityModalOpen(false),
      onSaveAndExit: handleSaveAndExit,
      onNext: handleNext,
      onBack: handleBack,
      onStepClick: handleStepClick,
      onPublishSubmit: handlePublishSubmit,
      onCloseDetailAddressConfirm: closeDetailAddressConfirm,
      onConfirmDetailAddress: confirmDetailAddress,
      onClearError: clearError,
    },
  };
};
