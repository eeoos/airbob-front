import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { accommodationApi } from "../../../../api";
import { invalidateProfileHostListingCaches } from "../../../profile/publicCache";
import { invalidateAccommodationDetailCaches } from "../../publicCache";
import {
  AccommodationApiUpdateData,
  AccommodationEditFormData,
  AccommodationEditUpdateData,
  buildAccommodationUpdateData,
  cloneAccommodationEditFormData,
  hasAccommodationDetailAddress,
  toAccommodationApiUpdateData,
} from "../lib/accommodationEditMapper";
import { areImageItemsChanged } from "../lib/accommodationEditDirty";
import { AccommodationEditImageItem } from "../lib/imageItems";
import { AccommodationEditStep } from "./useAccommodationEditForm";

interface PreventableEvent {
  preventDefault: () => void;
}

interface PersistenceOperation {
  accommodationId: string;
}

interface PersistenceSubmission {
  submittedFormData: AccommodationEditFormData;
  updateData: AccommodationEditUpdateData;
  apiUpdateData: ReturnType<typeof toAccommodationApiUpdateData>;
}

type CommitPersistedFormData = (
  accommodationId: string,
  submittedFormData: AccommodationEditFormData,
  persistedUpdateData: ReturnType<typeof toAccommodationApiUpdateData>
) => void;

interface AccommodationEditSaveBaseOptions {
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
  publishAccommodation?: (accommodationId: number) => Promise<unknown>;
}

type UseAccommodationEditSaveOptions = AccommodationEditSaveBaseOptions &
  (
    | {
        updateAccommodation?: undefined;
        commitPersistedFormData: CommitPersistedFormData;
      }
    | {
        updateAccommodation: (
          accommodationId: number,
          updateData: AccommodationApiUpdateData
        ) => Promise<unknown>;
        commitPersistedFormData?: CommitPersistedFormData;
      }
  );

const defaultUpdateAccommodation = (
  accommodationId: number,
  updateData: AccommodationApiUpdateData
) => accommodationApi.update(accommodationId, updateData);

const defaultPublishAccommodation = (accommodationId: number) =>
  accommodationApi.publish(accommodationId);

const defaultPrepareImagesForPersistence = async () => true;
const defaultHasPendingImageChanges = () => false;
const defaultCommitPersistedFormData = () => undefined;

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
  commitPersistedFormData = defaultCommitPersistedFormData,
}: UseAccommodationEditSaveOptions) => {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<{
    accommodationId: string;
    run: () => void;
  } | null>(null);
  const activeAccommodationIdRef = useRef(accommodationId);
  const activePersistenceRef = useRef<PersistenceOperation | null>(null);
  const previousAccommodationIdRef = useRef(accommodationId);

  activeAccommodationIdRef.current = accommodationId;

  useEffect(() => {
    if (previousAccommodationIdRef.current === accommodationId) return;
    previousAccommodationIdRef.current = accommodationId;
    activePersistenceRef.current = null;
    setPendingAction(null);
    setIsSaving(false);
  }, [accommodationId, setIsSaving]);

  useEffect(
    () => () => {
      activePersistenceRef.current = null;
    },
    []
  );

  const beginPersistence = useCallback(() => {
    if (!accommodationId || activePersistenceRef.current) return null;

    const operation = {
      accommodationId,
    };
    activePersistenceRef.current = operation;
    return operation;
  }, [accommodationId]);

  const isCurrentPersistence = useCallback(
    (operation: PersistenceOperation) =>
      activeAccommodationIdRef.current === operation.accommodationId &&
      activePersistenceRef.current === operation,
    []
  );

  const finishPersistence = useCallback(
    (operation: PersistenceOperation) => {
      if (activePersistenceRef.current !== operation) return;
      activePersistenceRef.current = null;
      setIsSaving(false);
    },
    [setIsSaving]
  );

  const invalidateAccommodationCaches = useCallback(async () => {
    await Promise.all([
      invalidateAccommodationDetailCaches(queryClient),
      invalidateProfileHostListingCaches(queryClient),
    ]);
  }, [queryClient]);

  const hasMissingDetailAddress = useCallback(
    () => currentStep === 1 && !hasAccommodationDetailAddress(formData),
    [currentStep, formData]
  );

  const requestDetailAddressConfirm = useCallback(
    (action: () => void) => {
      if (!accommodationId) return;
      setPendingAction({ accommodationId, run: action });
    },
    [accommodationId]
  );

  const closeDetailAddressConfirm = useCallback(() => {
    setPendingAction(null);
  }, []);

  const confirmDetailAddress = useCallback(() => {
    if (
      pendingAction &&
      pendingAction.accommodationId === activeAccommodationIdRef.current
    ) {
      pendingAction.run();
    }
    setPendingAction(null);
  }, [pendingAction]);

  const captureSubmission = useCallback((): PersistenceSubmission => {
    const submittedFormData = cloneAccommodationEditFormData(formData);
    const submittedInitialFormData = initialFormData
      ? cloneAccommodationEditFormData(initialFormData)
      : null;
    const updateData = buildAccommodationUpdateData({
      isDraft: isNewDraft && submittedInitialFormData === null,
      formData: submittedFormData,
      initialFormData: submittedInitialFormData,
    });

    return {
      submittedFormData,
      updateData,
      apiUpdateData: toAccommodationApiUpdateData(updateData),
    };
  }, [formData, initialFormData, isNewDraft]);

  const persistSubmission = useCallback(
    async (
      operation: PersistenceOperation,
      submission: PersistenceSubmission
    ) => {
      await updateAccommodation(
        Number(operation.accommodationId),
        submission.apiUpdateData
      );
      if (!isCurrentPersistence(operation)) return false;

      commitPersistedFormData(
        operation.accommodationId,
        submission.submittedFormData,
        submission.apiUpdateData
      );
      await invalidateAccommodationCaches();
      return isCurrentPersistence(operation);
    },
    [
      commitPersistedFormData,
      invalidateAccommodationCaches,
      isCurrentPersistence,
      updateAccommodation,
    ]
  );

  const runSaveAndExit = useCallback(async () => {
    const operation = beginPersistence();
    if (!operation) return;
    const submission = captureSubmission();

    setIsSaving(true);
    clearError();

    try {
      const isPrepared = await prepareImagesForPersistence();
      if (!isPrepared || !isCurrentPersistence(operation)) return;

      const imageChanged = areImageItemsChanged({
        isNewDraft,
        currentImageItems: imageItems,
        initialImageItems,
      });
      const hasFormChanges = Object.keys(submission.updateData).length > 0;

      if (hasFormChanges) {
        const persisted = await persistSubmission(operation, submission);
        if (!persisted) return;
      } else if (imageChanged) {
        await invalidateAccommodationCaches();
        if (!isCurrentPersistence(operation)) return;
      }

      navigateToHostProfile();
    } catch (err) {
      if (isCurrentPersistence(operation)) {
        handleError(err);
      }
    } finally {
      finishPersistence(operation);
    }
  }, [
    clearError,
    beginPersistence,
    captureSubmission,
    finishPersistence,
    handleError,
    imageItems,
    initialImageItems,
    invalidateAccommodationCaches,
    isCurrentPersistence,
    isNewDraft,
    navigateToHostProfile,
    prepareImagesForPersistence,
    persistSubmission,
    setIsSaving,
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
    const operation = beginPersistence();
    if (!operation) return;
    const submission = captureSubmission();

    setIsSaving(true);
    clearError();

    try {
      const hadPendingImageChanges = hasPendingImageChanges();
      const isPrepared = await prepareImagesForPersistence();
      if (!isPrepared || !isCurrentPersistence(operation)) return;

      if (Object.keys(submission.updateData).length > 0) {
        const persisted = await persistSubmission(operation, submission);
        if (!persisted) return;
      } else if (hadPendingImageChanges) {
        await invalidateAccommodationCaches();
      }
      if (!isCurrentPersistence(operation)) return;

      await publishAccommodation(Number(operation.accommodationId));
      if (!isCurrentPersistence(operation)) return;
      await invalidateAccommodationCaches();
      if (!isCurrentPersistence(operation)) return;
      navigateToHostProfile();
    } catch (err) {
      if (isCurrentPersistence(operation)) {
        handleError(err);
      }
    } finally {
      finishPersistence(operation);
    }
  }, [
    beginPersistence,
    captureSubmission,
    clearError,
    finishPersistence,
    hasPendingImageChanges,
    handleError,
    invalidateAccommodationCaches,
    isCurrentPersistence,
    navigateToHostProfile,
    prepareImagesForPersistence,
    persistSubmission,
    publishAccommodation,
    setIsSaving,
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
    const operation = beginPersistence();
    if (!operation) return false;
    const submission = captureSubmission();

    setIsSaving(true);
    clearError();

    try {
      return await persistSubmission(operation, submission);
    } catch (err) {
      if (isCurrentPersistence(operation)) {
        handleError(err);
      }
      return false;
    } finally {
      finishPersistence(operation);
    }
  }, [
    beginPersistence,
    captureSubmission,
    clearError,
    finishPersistence,
    handleError,
    isCurrentPersistence,
    persistSubmission,
    setIsSaving,
  ]);

  return {
    showDetailAddressConfirm: pendingAction !== null,
    requestDetailAddressConfirm,
    closeDetailAddressConfirm,
    confirmDetailAddress,
    handleSaveAndExit,
    handlePublish,
    saveStepData,
  };
};
