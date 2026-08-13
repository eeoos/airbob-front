import { useCallback, useEffect, useRef } from "react";
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
  const activeSessionRef = useRef({ accommodationId });
  const mountedRef = useRef(true);
  const resetProgressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  if (activeSessionRef.current.accommodationId !== accommodationId) {
    activeSessionRef.current = { accommodationId };
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (resetProgressTimeoutRef.current) {
        clearTimeout(resetProgressTimeoutRef.current);
      }
    };
  }, []);

  const uploadPendingImages = useCallback(async () => {
    if (!accommodationId) {
      return true;
    }

    const filesToUpload = getPendingFiles();
    if (filesToUpload.length === 0) {
      return true;
    }

    const uploadSession = activeSessionRef.current;
    const isCurrentUpload = () =>
      mountedRef.current && activeSessionRef.current === uploadSession;

    if (resetProgressTimeoutRef.current) {
      clearTimeout(resetProgressTimeoutRef.current);
      resetProgressTimeoutRef.current = null;
    }

    setUploadProgress(0);
    clearError();

    try {
      const response = await accommodationApi.uploadImages(
        Number(accommodationId),
        filesToUpload,
        (progress) => {
          if (isCurrentUpload()) {
            setUploadProgress(progress);
          }
        }
      );

      if (!isCurrentUpload()) {
        return false;
      }

      applyUploadedImages(response.uploaded_images);
      setUploadProgress(100);
      return true;
    } catch (error) {
      if (!isCurrentUpload()) {
        return false;
      }

      handleError(error);
      setUploadProgress(0);
      return false;
    } finally {
      if (isCurrentUpload()) {
        resetProgressTimeoutRef.current = setTimeout(() => {
          if (isCurrentUpload()) {
            setUploadProgress(0);
          }
          resetProgressTimeoutRef.current = null;
        }, resetProgressDelayMs);
      }
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
