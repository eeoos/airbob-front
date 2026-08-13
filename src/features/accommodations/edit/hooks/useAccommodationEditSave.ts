import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { accommodationApi } from "../../../../api";
import { invalidateProfileHostListingCaches } from "../../../profile/publicCache";
import { invalidateAccommodationDetailCaches } from "../../publicCache";
import {
  AccommodationEditFormData,
  AccommodationEditUpdateData,
  buildAccommodationUpdateData,
  toAccommodationApiUpdateData,
} from "../lib/accommodationEditMapper";
import { areImageItemsChanged } from "../lib/accommodationEditDirty";
import { AccommodationEditImageItem } from "../lib/imageItems";
import { AccommodationEditStep } from "./useAccommodationEditForm";

interface PreventableEvent {
  preventDefault: () => void;
}

interface UseAccommodationEditSaveOptions {
  accommodationId?: string;
  currentStep: AccommodationEditStep;
  isNewDraft: boolean;
  formData: AccommodationEditFormData;
  initialFormData: AccommodationEditFormData | null;
  imageItems: AccommodationEditImageItem[];
  initialImageItems: AccommodationEditImageItem[];
  clearError: () => void;
  handleError: (error: unknown) => void;
  setIsSaving: (isSaving: boolean) => void;
  navigateToHostProfile: () => void;
  prepareImagesForPersistence?: () => Promise<boolean>;
  hasPendingImageChanges?: () => boolean;
  updateAccommodation?: (
    accommodationId: number,
    updateData: AccommodationEditUpdateData
  ) => Promise<unknown>;
  publishAccommodation?: (accommodationId: number) => Promise<unknown>;
}

const defaultUpdateAccommodation = (
  accommodationId: number,
  updateData: AccommodationEditUpdateData
) => accommodationApi.update(accommodationId, toAccommodationApiUpdateData(updateData));

const defaultPublishAccommodation = (accommodationId: number) =>
  accommodationApi.publish(accommodationId);

const defaultPrepareImagesForPersistence = async () => true;
const defaultHasPendingImageChanges = () => false;

export const useAccommodationEditSave = ({
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
  navigateToHostProfile,
  prepareImagesForPersistence = defaultPrepareImagesForPersistence,
  hasPendingImageChanges = defaultHasPendingImageChanges,
  updateAccommodation = defaultUpdateAccommodation,
  publishAccommodation = defaultPublishAccommodation,
}: UseAccommodationEditSaveOptions) => {
  const queryClient = useQueryClient();
  const [showDetailAddressConfirm, setShowDetailAddressConfirm] =
    useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const isPersistenceRunningRef = useRef(false);

  const invalidateAccommodationCaches = useCallback(async () => {
    await Promise.all([
      invalidateAccommodationDetailCaches(queryClient),
      invalidateProfileHostListingCaches(queryClient),
    ]);
  }, [queryClient]);

  const hasMissingDetailAddress = useCallback(
    () =>
      currentStep === 1 &&
      (!formData.addressInfo.detail || formData.addressInfo.detail.trim() === ""),
    [currentStep, formData.addressInfo.detail]
  );

  const requestDetailAddressConfirm = useCallback((action: () => void) => {
    setPendingAction(() => action);
    setShowDetailAddressConfirm(true);
  }, []);

  const closeDetailAddressConfirm = useCallback(() => {
    setShowDetailAddressConfirm(false);
    setPendingAction(null);
  }, []);

  const confirmDetailAddress = useCallback(() => {
    if (pendingAction) {
      pendingAction();
    }
    setShowDetailAddressConfirm(false);
    setPendingAction(null);
  }, [pendingAction]);

  const getUpdateData = useCallback(
    () =>
      buildAccommodationUpdateData({
        isDraft: isNewDraft && initialFormData === null,
        formData,
        initialFormData,
      }),
    [formData, initialFormData, isNewDraft]
  );

  const runSaveAndExit = useCallback(async () => {
    if (!accommodationId || isPersistenceRunningRef.current) return;

    isPersistenceRunningRef.current = true;
    setIsSaving(true);
    clearError();

    try {
      const isPrepared = await prepareImagesForPersistence();
      if (!isPrepared) return;

      const updateData = getUpdateData();
      const imageChanged = areImageItemsChanged({
        isNewDraft,
        currentImageItems: imageItems,
        initialImageItems,
      });
      const hasChanges = Object.keys(updateData).length > 0 || imageChanged;

      if (hasChanges) {
        await updateAccommodation(Number(accommodationId), updateData);
        await invalidateAccommodationCaches();
      }

      navigateToHostProfile();
    } catch (err) {
      handleError(err);
    } finally {
      isPersistenceRunningRef.current = false;
      setIsSaving(false);
    }
  }, [
    accommodationId,
    clearError,
    getUpdateData,
    handleError,
    imageItems,
    initialImageItems,
    invalidateAccommodationCaches,
    isNewDraft,
    navigateToHostProfile,
    prepareImagesForPersistence,
    setIsSaving,
    updateAccommodation,
  ]);

  const handleSaveAndExit = useCallback(async () => {
    if (!accommodationId) return;

    if (hasMissingDetailAddress()) {
      requestDetailAddressConfirm(() => {
        void runSaveAndExit();
      });
      return;
    }

    await runSaveAndExit();
  }, [
    accommodationId,
    hasMissingDetailAddress,
    requestDetailAddressConfirm,
    runSaveAndExit,
  ]);

  const runPublish = useCallback(async () => {
    if (!accommodationId || isPersistenceRunningRef.current) return;

    isPersistenceRunningRef.current = true;
    setIsSaving(true);
    clearError();

    try {
      const hadPendingImageChanges = hasPendingImageChanges();
      const isPrepared = await prepareImagesForPersistence();
      if (!isPrepared) return;

      const updateData = getUpdateData();

      if (Object.keys(updateData).length > 0) {
        await updateAccommodation(Number(accommodationId), updateData);
        await invalidateAccommodationCaches();
      } else if (hadPendingImageChanges) {
        await invalidateAccommodationCaches();
      }

      await publishAccommodation(Number(accommodationId));
      await invalidateAccommodationCaches();
      navigateToHostProfile();
    } catch (err) {
      handleError(err);
    } finally {
      isPersistenceRunningRef.current = false;
      setIsSaving(false);
    }
  }, [
    accommodationId,
    clearError,
    getUpdateData,
    hasPendingImageChanges,
    handleError,
    invalidateAccommodationCaches,
    navigateToHostProfile,
    prepareImagesForPersistence,
    publishAccommodation,
    setIsSaving,
    updateAccommodation,
  ]);

  const handlePublish = useCallback(
    async (e?: PreventableEvent) => {
      e?.preventDefault();
      if (!accommodationId) return;

      if (hasMissingDetailAddress()) {
        requestDetailAddressConfirm(() => {
          void runPublish();
        });
        return;
      }

      await runPublish();
    },
    [
      accommodationId,
      hasMissingDetailAddress,
      requestDetailAddressConfirm,
      runPublish,
    ]
  );

  const saveStepData = useCallback(async () => {
    if (!accommodationId) return false;

    setIsSaving(true);
    clearError();

    try {
      await updateAccommodation(Number(accommodationId), getUpdateData());
      await invalidateAccommodationCaches();
      return true;
    } catch (err) {
      handleError(err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    accommodationId,
    clearError,
    getUpdateData,
    handleError,
    invalidateAccommodationCaches,
    setIsSaving,
    updateAccommodation,
  ]);

  return {
    showDetailAddressConfirm,
    requestDetailAddressConfirm,
    closeDetailAddressConfirm,
    confirmDetailAddress,
    handleSaveAndExit,
    handlePublish,
    saveStepData,
    getUpdateData,
  };
};
