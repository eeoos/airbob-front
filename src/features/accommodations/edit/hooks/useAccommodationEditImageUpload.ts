import { useCallback } from "react";
import { accommodationApi } from "../../../../api";
import { ImageInfo } from "../../../../types/accommodation";

interface UseAccommodationEditImageUploadOptions {
  accommodationId?: string;
  applyUploadedImages: (uploadedImages: ImageInfo[]) => void;
  clearError: () => void;
  getPendingFiles: () => File[];
  handleError: (error: unknown) => void;
  resetProgressDelayMs?: number;
  setUploadProgress: (progress: number) => void;
}

export function useAccommodationEditImageUpload({
  accommodationId,
  applyUploadedImages,
  clearError,
  getPendingFiles,
  handleError,
  resetProgressDelayMs = 500,
  setUploadProgress,
}: UseAccommodationEditImageUploadOptions) {
  const uploadPendingImages = useCallback(async () => {
    if (!accommodationId) {
      return true;
    }

    const filesToUpload = getPendingFiles();
    if (filesToUpload.length === 0) {
      return true;
    }

    setUploadProgress(0);
    clearError();

    try {
      const response = await accommodationApi.uploadImages(
        Number(accommodationId),
        filesToUpload,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      applyUploadedImages(response.uploaded_images);
      setUploadProgress(100);
      return true;
    } catch (error) {
      handleError(error);
      setUploadProgress(0);
      return false;
    } finally {
      setTimeout(() => {
        setUploadProgress(0);
      }, resetProgressDelayMs);
    }
  }, [
    accommodationId,
    applyUploadedImages,
    clearError,
    getPendingFiles,
    handleError,
    resetProgressDelayMs,
    setUploadProgress,
  ]);

  return {
    uploadPendingImages,
  };
}
