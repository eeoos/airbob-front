import { useCallback, useEffect, useRef, useState } from "react";
import { accommodationApi } from "../../../../api";
import { isApiClientError } from "../../../../api/response";
import { ImageInfo } from "../../../../types/accommodation";
import {
  AccommodationEditImageItem,
  applyUploadedImagesToItems,
  createImageItems,
  filterValidImageFiles,
  getPendingUploadFiles,
  mapHostImagesToImageItems,
  removeImageItem,
  reorderImageItems,
} from "../lib/imageItems";

interface UseAccommodationEditImagesOptions {
  accommodationId?: string;
  onError: (error: unknown) => void;
  createObjectURL?: (file: File) => string;
  revokeObjectURL?: (url: string) => void;
  deleteImage?: (accommodationId: number, imageId: number) => Promise<unknown>;
  getAccommodationDetail?: (
    accommodationId: number
  ) => Promise<{ images: ImageInfo[] }>;
}

const defaultCreateObjectURL = (file: File) => URL.createObjectURL(file);
const defaultRevokeObjectURL = (url: string) => URL.revokeObjectURL(url);
const defaultDeleteImage = (accommodationId: number, imageId: number) =>
  accommodationApi.deleteImage(accommodationId, imageId);
const defaultGetAccommodationDetail = (accommodationId: number) =>
  accommodationApi.getHostAccommodationDetail(accommodationId);

type DeleteFailureKind = "absent" | "rejected" | "ambiguous";

interface ImageEditSession {
  accommodationId?: string;
}

interface PendingDeleteReconciliation {
  accommodationId: string;
  deleteError: unknown;
  imageId: number;
  restoreRemovedImage: () => void;
  session: ImageEditSession;
}

const isAxiosError = (
  error: unknown
): error is {
  isAxiosError: true;
  response?: {
    status: number;
    data?: { error?: { code?: string } | null };
  };
} =>
  typeof error === "object" &&
  error !== null &&
  "isAxiosError" in error &&
  error.isAxiosError === true;

const classifyDeleteFailure = (error: unknown): DeleteFailureKind => {
  if (isApiClientError(error)) {
    if (error.status === 404 || error.code === "I004") {
      return "absent";
    }

    return error.status === 0 || error.status === 408 || error.status >= 500
      ? "ambiguous"
      : "rejected";
  }

  if (isAxiosError(error)) {
    if (!error.response) {
      return "ambiguous";
    }

    if (
      error.response.status === 404 ||
      error.response.data?.error?.code === "I004"
    ) {
      return "absent";
    }

    return error.response.status === 408 || error.response.status >= 500
      ? "ambiguous"
      : "rejected";
  }

  return "ambiguous";
};

const cloneImageItems = (items: AccommodationEditImageItem[]) =>
  items.map((item) => ({ ...item }));

export const useAccommodationEditImages = ({
  accommodationId,
  onError,
  createObjectURL = defaultCreateObjectURL,
  revokeObjectURL = defaultRevokeObjectURL,
  deleteImage = defaultDeleteImage,
  getAccommodationDetail = defaultGetAccommodationDetail,
}: UseAccommodationEditImagesOptions) => {
  const [imageItems, setImageItems] = useState<AccommodationEditImageItem[]>([]);
  const [initialImageItems, setInitialImageItems] = useState<
    AccommodationEditImageItem[]
  >([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const imageItemsRef = useRef<AccommodationEditImageItem[]>([]);
  const pendingDeleteRef = useRef<Promise<boolean> | null>(null);
  const pendingDeleteReconciliationRef =
    useRef<PendingDeleteReconciliation | null>(null);
  const imageSessionRef = useRef<ImageEditSession>({ accommodationId });
  const mountedRef = useRef(true);

  if (imageSessionRef.current.accommodationId !== accommodationId) {
    imageSessionRef.current = { accommodationId };
  }

  const isCurrentImageSession = useCallback(
    (session: ImageEditSession) =>
      mountedRef.current && imageSessionRef.current === session,
    []
  );

  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

  useEffect(() => {
    imageItemsRef.current.forEach((item) => {
      if (item.preview) {
        revokeObjectURL(item.preview);
      }
    });
    imageItemsRef.current = [];
    pendingDeleteRef.current = null;
    pendingDeleteReconciliationRef.current = null;
    setImageItems([]);
    setInitialImageItems([]);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDeletingImage(false);
  }, [accommodationId, revokeObjectURL]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      imageItemsRef.current.forEach((item) => {
        if (item.preview) {
          revokeObjectURL(item.preview);
        }
      });
    };
  }, [revokeObjectURL]);

  const loadImages = useCallback((images: ImageInfo[]) => {
    const loadedImageItems = mapHostImagesToImageItems(
      images.map((image, index) => ({
        ...image,
        tempId: `existing-${index}-${Date.now()}`,
      }))
    );
    setImageItems(loadedImageItems);
    setInitialImageItems(cloneImageItems(loadedImageItems));
    return loadedImageItems;
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const result = filterValidImageFiles(files);
      result.errors.forEach((message) => {
        onError(new Error(message));
      });

      if (result.validFiles.length === 0) {
        return [];
      }

      const pendingInputs = result.validFiles.map((file, index) => ({
        file,
        preview: createObjectURL(file),
        tempId: `temp-${Date.now()}-${Math.random()}-${index}-${file.name}`,
      }));
      const newItems = createImageItems(pendingInputs);

      setImageItems((prev) => [...prev, ...newItems]);
      return newItems;
    },
    [createObjectURL, onError]
  );

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        addFiles(files);
      }
      e.target.value = "";
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        addFiles(files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const reconcileImageDeletion = useCallback(
    async (
      reconciliation: PendingDeleteReconciliation
    ): Promise<boolean> => {
      try {
        const detail = await getAccommodationDetail(
          Number(reconciliation.accommodationId)
        );

        if (!isCurrentImageSession(reconciliation.session)) {
          return false;
        }

        pendingDeleteReconciliationRef.current = null;
        const imageRemains = detail.images.some(
          (image) => image.id === reconciliation.imageId
        );
        if (!imageRemains) {
          return true;
        }

        reconciliation.restoreRemovedImage();
        onError(reconciliation.deleteError);
        return false;
      } catch (reconciliationError) {
        if (!isCurrentImageSession(reconciliation.session)) {
          return false;
        }

        pendingDeleteReconciliationRef.current = reconciliation;
        onError(reconciliationError);
        return false;
      }
    },
    [getAccommodationDetail, isCurrentImageSession, onError]
  );

  const handleImageRemove = useCallback(
    (index: number) => {
      if (
        pendingDeleteRef.current ||
        pendingDeleteReconciliationRef.current
      ) {
        return;
      }

      const { nextItems, removedItem, previewToRevoke, imageIdToDelete } =
        removeImageItem(imageItems, index);

      if (!removedItem) {
        return;
      }

      if (previewToRevoke) {
        revokeObjectURL(previewToRevoke);
      }

      if (imageIdToDelete && accommodationId) {
        const deletionAccommodationId = accommodationId;
        const deletionSession = imageSessionRef.current;
        setIsDeletingImage(true);
        let deleteRequest: Promise<unknown>;
        try {
          deleteRequest = deleteImage(Number(accommodationId), imageIdToDelete);
        } catch (error) {
          deleteRequest = Promise.reject(error);
        }

        const restoreRemovedImage = () => {
          if (!isCurrentImageSession(deletionSession)) {
            return;
          }

          setImageItems((currentItems) => {
            const isAlreadyPresent = currentItems.some(
              (item) => item.tempId === removedItem.tempId
            );

            if (isAlreadyPresent) {
              return currentItems;
            }

            const restoredItems = [...currentItems];
            restoredItems.splice(
              Math.min(index, restoredItems.length),
              0,
              removedItem
            );
            return restoredItems;
          });
        };

        const deletion = deleteRequest
          .then(() => isCurrentImageSession(deletionSession))
          .catch(async (error) => {
            if (!isCurrentImageSession(deletionSession)) {
              return false;
            }

            const failureKind = classifyDeleteFailure(error);
            if (failureKind === "absent") {
              return true;
            }

            if (failureKind === "rejected") {
              restoreRemovedImage();
              onError(error);
              return false;
            }

            return reconcileImageDeletion({
              accommodationId: deletionAccommodationId,
              deleteError: error,
              imageId: imageIdToDelete,
              restoreRemovedImage,
              session: deletionSession,
            });
          })
          .finally(() => {
            if (
              isCurrentImageSession(deletionSession) &&
              pendingDeleteRef.current === deletion
            ) {
              pendingDeleteRef.current = null;
              setIsDeletingImage(false);
            }
          });
        pendingDeleteRef.current = deletion;
      }

      setImageItems(nextItems);
    },
    [
      accommodationId,
      deleteImage,
      imageItems,
      isCurrentImageSession,
      onError,
      reconcileImageDeletion,
      revokeObjectURL,
    ]
  );

  const waitForPendingImageDeletes = useCallback(() => {
    if (pendingDeleteRef.current) {
      return pendingDeleteRef.current;
    }

    const reconciliation = pendingDeleteReconciliationRef.current;
    if (!reconciliation) {
      return Promise.resolve(true);
    }

    if (!isCurrentImageSession(reconciliation.session)) {
      pendingDeleteReconciliationRef.current = null;
      return Promise.resolve(true);
    }

    setIsDeletingImage(true);
    const retry = reconcileImageDeletion(reconciliation).finally(() => {
      if (pendingDeleteRef.current !== retry) {
        return;
      }

      pendingDeleteRef.current = null;
      if (isCurrentImageSession(reconciliation.session)) {
        setIsDeletingImage(false);
      }
    });
    pendingDeleteRef.current = retry;
    return retry;
  }, [isCurrentImageSession, reconcileImageDeletion]);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
    setDragOverIndex(null);
  }, []);

  const handleDragOverItem = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (draggedIndex === null || draggedIndex === index) return;

      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragOverIndex, draggedIndex]
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const currentDraggedIndex = draggedIndex;
      const currentDragOverIndex = dragOverIndex;

      if (
        currentDraggedIndex !== null &&
        currentDragOverIndex !== null &&
        currentDraggedIndex !== currentDragOverIndex
      ) {
        setImageItems((prevItems) => {
          const items = prevItems.length > 0 ? prevItems : imageItemsRef.current;
          return reorderImageItems(
            items,
            currentDraggedIndex,
            currentDragOverIndex
          );
        });
      }

      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [dragOverIndex, draggedIndex]
  );

  const applyUploadedImages = useCallback(
    (uploadedImages: ImageInfo[]) => {
      setImageItems((prev) => {
        const result = applyUploadedImagesToItems(prev, uploadedImages);
        result.previewsToRevoke.forEach((preview) => {
          revokeObjectURL(preview);
        });
        return result.items;
      });
    },
    [revokeObjectURL]
  );

  const getPendingFiles = useCallback(
    () => getPendingUploadFiles(imageItems),
    [imageItems]
  );

  return {
    imageItems,
    initialImageItems,
    draggedIndex,
    dragOverIndex,
    isDeletingImage,
    loadImages,
    addFiles,
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
  };
};
