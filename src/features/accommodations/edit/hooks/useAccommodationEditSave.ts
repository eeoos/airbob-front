import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { accommodationApi } from "../../../../api";
import { profileQueryKeys } from "../../../profile/queryKeys";
import { accommodationQueryKeys } from "../../queryKeys";
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
  updateAccommodation = defaultUpdateAccommodation,
  publishAccommodation = defaultPublishAccommodation,
}: UseAccommodationEditSaveOptions) => {
  const queryClient = useQueryClient();
  const [showDetailAddressConfirm, setShowDetailAddressConfirm] =
    useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const invalidateAccommodationCaches = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: accommodationQueryKeys.detailRoot,
      }),
      queryClient.invalidateQueries({
        queryKey: profileQueryKeys.hostListingsRoot,
      }),
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
        isDraft: isNewDraft,
        formData,
        initialFormData,
      }),
    [formData, initialFormData, isNewDraft]
  );

  const runSaveAndExit = useCallback(async () => {
    if (!accommodationId) return;

    setIsSaving(true);
    clearError();

    try {
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
    if (!accommodationId) return;

    setIsSaving(true);
    clearError();

    try {
      const updateData = getUpdateData();

      if (Object.keys(updateData).length > 0) {
        await updateAccommodation(Number(accommodationId), updateData);
        await invalidateAccommodationCaches();
      }

      await publishAccommodation(Number(accommodationId));
      await invalidateAccommodationCaches();
      navigateToHostProfile();
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  }, [
    accommodationId,
    clearError,
    getUpdateData,
    handleError,
    invalidateAccommodationCaches,
    navigateToHostProfile,
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
