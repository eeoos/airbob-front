import { useCallback, useState } from "react";
import { accommodationApi } from "../../../api/accommodations";
import { useApiError } from "../../../hooks/useApiError";

type ConfirmDelete = (message: string) => boolean;

interface UseAccommodationActionsOptions {
  confirmDelete?: ConfirmDelete;
  onClose: () => void;
  onSuccess?: () => void;
}

const defaultConfirmDelete: ConfirmDelete = (message) => window.confirm(message);

export function useAccommodationActions({
  confirmDelete = defaultConfirmDelete,
  onClose,
  onSuccess,
}: UseAccommodationActionsOptions) {
  const { error, handleError, clearError } = useApiError();
  const [isProcessing, setIsProcessing] = useState(false);

  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      if (isProcessing) {
        return false;
      }

      setIsProcessing(true);
      clearError();

      try {
        await action();
        onSuccess?.();
        onClose();
        return true;
      } catch (error) {
        handleError(error);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [clearError, handleError, isProcessing, onClose, onSuccess]
  );

  const publishAccommodation = useCallback(
    (accommodationId: number) =>
      runAction(() => accommodationApi.publish(accommodationId)),
    [runAction]
  );

  const unpublishAccommodation = useCallback(
    (accommodationId: number) =>
      runAction(() => accommodationApi.unpublish(accommodationId)),
    [runAction]
  );

  const deleteAccommodation = useCallback(
    async (accommodationId: number) => {
      if (!confirmDelete("정말 이 리스팅을 삭제하시겠습니까?")) {
        return false;
      }

      return runAction(() => accommodationApi.delete(accommodationId));
    },
    [confirmDelete, runAction]
  );

  return {
    clearError,
    deleteAccommodation,
    error,
    isProcessing,
    publishAccommodation,
    unpublishAccommodation,
  };
}
