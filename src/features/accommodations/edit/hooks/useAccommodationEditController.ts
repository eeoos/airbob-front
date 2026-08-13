import React, { useCallback, useEffect, useRef, useState } from "react";
import { useApiError } from "../../../../hooks/useApiError";
import type {
  AccommodationEditScreenActions,
  AccommodationEditScreenState,
} from "../components/AccommodationEditScreen";
import { AccommodationEditAddressInfo } from "../lib/daumAddressMapper";
import { hasAccommodationDetailAddress } from "../lib/accommodationEditMapper";
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
  const editorSessionRef = useRef({ accommodationId });
  const activeStepTransitionRef = useRef<symbol | null>(null);

  if (editorSessionRef.current.accommodationId !== accommodationId) {
    editorSessionRef.current = { accommodationId };
    activeStepTransitionRef.current = null;
  }

  const {
    formData,
    setFormData,
    initialFormData,
    persistedAccommodationId,
    selectedAmenities,
    setSelectedAmenities,
    openTimePicker,
    setOpenTimePicker,
    loadAccommodation,
    commitPersistedFormData,
    handleInputChange,
    handleNestedChange,
    handleTimeChange,
    isStepCompleted: isFormStepCompleted,
    canProceedToNext: canProceedToNextStep,
  } = useAccommodationEditForm(accommodationId);

  const {
    imageItems,
    initialImageItems,
    draggedIndex,
    dragOverIndex,
    isDeletingImage,
    loadImages,
    handleImageSelect,
    handleDrop,
    handleDragOver,
    handleImageRemove,
    waitForPendingImageDeletes,
    handleDragStart,
    handleDragOverItem,
    handleDragEnd,
    applyUploadedImages,
    getPendingFiles,
  } = useAccommodationEditImages({
    accommodationId,
    onError: handleError,
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

  const { detailState, retry: retryDetail } = useAccommodationEditDetail({
    accommodationId,
    loadAccommodation,
    loadImages,
    handleError,
  });

  useEffect(() => {
    setCurrentStep(1);
    setIsSaving(false);
    setUploadProgress(0);
    setIsTypeModalOpen(false);
    setIsAmenityModalOpen(false);
    clearError();
  }, [accommodationId, clearError]);

  const isEditorReady =
    detailState.status === "ready" &&
    detailState.accommodationId === accommodationId &&
    persistedAccommodationId === accommodationId;

  const { uploadPendingImages } = useAccommodationEditImageUpload({
    accommodationId,
    applyUploadedImages,
    clearError,
    getPendingFiles,
    handleError,
    setUploadProgress,
  });

  const prepareImagesForPersistence = useCallback(async () => {
    const deletionsSucceeded = await waitForPendingImageDeletes();
    if (!deletionsSucceeded) return false;

    return uploadPendingImages();
  }, [uploadPendingImages, waitForPendingImageDeletes]);

  const hasPendingImageChanges = useCallback(
    () => getPendingFiles().length > 0,
    [getPendingFiles]
  );

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
    prepareImagesForPersistence,
    hasPendingImageChanges,
    commitPersistedFormData,
  });

  const isStepCompleted = (step: Step): boolean =>
    isEditorReady &&
    isFormStepCompleted(step, {
      imageCount: imageItems.length,
      isNewDraft,
    });

  const canProceedToNext = (): boolean =>
    isEditorReady &&
    canProceedToNextStep(currentStep, {
      imageCount: imageItems.length,
      isNewDraft,
    });

  const handleNext = async () => {
    if (!isEditorReady) return;
    const editorSession = editorSessionRef.current;

    if (currentStep === 1) {
      if (!hasAccommodationDetailAddress(formData)) {
        requestDetailAddressConfirm(() => {
          if (currentStep < 5) {
            setCurrentStep((prev) => (prev + 1) as Step);
          }
        });
        return;
      }
    }

    if (currentStep === 2) {
      if (activeStepTransitionRef.current) return;
      const transition = Symbol("photo-step-transition");
      activeStepTransitionRef.current = transition;
      setIsSaving(true);
      try {
        const prepared = await prepareImagesForPersistence();
        if (!prepared || editorSessionRef.current !== editorSession) return;
      } finally {
        if (editorSessionRef.current === editorSession) {
          setIsSaving(false);
        }
        if (activeStepTransitionRef.current === transition) {
          activeStepTransitionRef.current = null;
        }
      }
    }

    if (currentStep === 4 && accommodationId) {
      const saved = await saveStepData();
      if (!saved || editorSessionRef.current !== editorSession) return;
      setCurrentStep((prev) => (prev + 1) as Step);
      return;
    }

    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handlePublishSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!isEditorReady || currentStep !== 5) return;

      if (!hasAccommodationDetailAddress(formData)) {
        requestDetailAddressConfirm(() => {
          void handlePublish();
        });
        return;
      }

      await handlePublish();
    },
    [
      currentStep,
      formData,
      handlePublish,
      requestDetailAddressConfirm,
      isEditorReady,
    ]
  );

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const canNavigateToStep = (targetStep: Step): boolean => {
    if (!isEditorReady || isSaving || isDeletingImage) {
      return false;
    }

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
      detailState,
      isEditorReady,
      isSaving,
      isDeletingImage,
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
      onRetryDetail: () => {
        clearError();
        retryDetail();
      },
      onExitDetailError: onNavigateToHostProfile,
      onClearError: clearError,
    },
  };
};
