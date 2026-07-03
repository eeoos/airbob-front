import { useCallback, useEffect, useRef, useState } from "react";
import { accommodationApi } from "../../../../api";
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
}

const defaultCreateObjectURL = (file: File) => URL.createObjectURL(file);
const defaultRevokeObjectURL = (url: string) => URL.revokeObjectURL(url);
const defaultDeleteImage = (accommodationId: number, imageId: number) =>
  accommodationApi.deleteImage(accommodationId, imageId);

const cloneImageItems = (items: AccommodationEditImageItem[]) =>
  items.map((item) => ({ ...item }));

export const useAccommodationEditImages = ({
  accommodationId,
  onError,
  createObjectURL = defaultCreateObjectURL,
  revokeObjectURL = defaultRevokeObjectURL,
  deleteImage = defaultDeleteImage,
}: UseAccommodationEditImagesOptions) => {
  const [imageItems, setImageItems] = useState<AccommodationEditImageItem[]>([]);
  const [initialImageItems, setInitialImageItems] = useState<
    AccommodationEditImageItem[]
  >([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const imageItemsRef = useRef<AccommodationEditImageItem[]>([]);

  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

  useEffect(() => {
    return () => {
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

  const handleImageRemove = useCallback(
    (index: number) => {
      const { nextItems, removedItem, previewToRevoke, imageIdToDelete } =
        removeImageItem(imageItems, index);

      if (!removedItem) {
        return;
      }

      if (previewToRevoke) {
        revokeObjectURL(previewToRevoke);
      }

      if (imageIdToDelete && accommodationId) {
        deleteImage(Number(accommodationId), imageIdToDelete).catch(onError);
      }

      setImageItems(nextItems);
    },
    [accommodationId, deleteImage, imageItems, onError, revokeObjectURL]
  );

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
    setImageItems,
    initialImageItems,
    setInitialImageItems,
    draggedIndex,
    dragOverIndex,
    loadImages,
    addFiles,
    handleImageSelect,
    handleDrop,
    handleDragOver,
    handleImageRemove,
    handleDragStart,
    handleDragOverItem,
    handleDragEnd,
    applyUploadedImages,
    getPendingFiles,
  };
};
