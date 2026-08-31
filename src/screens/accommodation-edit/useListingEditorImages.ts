import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import type { ListingEditorImage } from "../../features/accommodations/listing-editor/model/listingEditor";
import {
  applyUploadedListingEditorImages,
  createPendingListingEditorImageItems,
  getPendingListingEditorFiles,
  removeListingEditorImage,
  reorderListingEditorImages,
  restoreListingEditorImage,
  toListingEditorImageItems,
  validateListingEditorImageFiles,
  type ListingEditorImageTombstone,
} from "../../features/accommodations/listing-editor/model/listingEditorImages";
import type { AccommodationEditImageItem } from "./editorViewContract";

interface UseListingEditorImagesOptions {
  readonly onError: (message: string) => void;
  readonly createObjectUrl?: (file: File) => string;
  readonly revokeObjectUrl?: (url: string) => void;
  readonly createClientId?: (file: File, index: number) => string;
}

const defaultCreateObjectUrl = (file: File) => URL.createObjectURL(file);
const defaultRevokeObjectUrl = (url: string) => URL.revokeObjectURL(url);
let nextLocalImageId = 0;
const defaultCreateClientId = (file: File, index: number) =>
  `local:${Date.now()}:${++nextLocalImageId}:${index}:${file.name}`;

export const useListingEditorImages = ({
  onError,
  createObjectUrl = defaultCreateObjectUrl,
  revokeObjectUrl = defaultRevokeObjectUrl,
  createClientId = defaultCreateClientId,
}: UseListingEditorImagesOptions) => {
  const [imageItems, setImageItems] = useState<AccommodationEditImageItem[]>(
    [],
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const imageItemsRef = useRef<AccommodationEditImageItem[]>([]);

  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

  useEffect(
    () => () => {
      imageItemsRef.current.forEach((item) => {
        if (item.preview) revokeObjectUrl(item.preview);
      });
    },
    [revokeObjectUrl],
  );

  const hydrate = useCallback(
    (images: readonly ListingEditorImage[]) => {
      imageItemsRef.current.forEach((item) => {
        if (item.preview) revokeObjectUrl(item.preview);
      });
      const next = toListingEditorImageItems(images).map((item) => ({
        ...item,
      }));
      imageItemsRef.current = next;
      setImageItems(next);
      setDraggedIndex(null);
      setDragOverIndex(null);
      setUploadProgress(0);
    },
    [revokeObjectUrl],
  );

  const addFiles = useCallback(
    (files: readonly File[]) => {
      const validation = validateListingEditorImageFiles(files);
      validation.errors.forEach(onError);
      if (validation.validFiles.length === 0) return;

      const pending = createPendingListingEditorImageItems(
        validation.validFiles.map((file, index) => ({
          clientId: createClientId(file, index),
          file,
          preview: createObjectUrl(file),
        })),
      ).map((item) => ({ ...item }));
      setImageItems((current) => [...current, ...pending]);
    },
    [createClientId, createObjectUrl, onError],
  );

  const removeAt = useCallback(
    (index: number): ListingEditorImageTombstone | null => {
      const removed = removeListingEditorImage(imageItemsRef.current, index);
      if (!removed.tombstone) return null;
      imageItemsRef.current = removed.items.map((item) => ({ ...item }));
      setImageItems(imageItemsRef.current);
      if (removed.tombstone.image.preview) {
        revokeObjectUrl(removed.tombstone.image.preview);
      }
      return removed.tombstone;
    },
    [revokeObjectUrl],
  );

  const restore = useCallback((tombstone: ListingEditorImageTombstone) => {
    setImageItems((current) => {
      const next = restoreListingEditorImage(current, tombstone).map(
        (item) => ({
          ...item,
        }),
      );
      imageItemsRef.current = next;
      return next;
    });
  }, []);

  const applyUploaded = useCallback(
    (images: readonly ListingEditorImage[]): boolean => {
      const applied = applyUploadedListingEditorImages(
        imageItemsRef.current,
        images,
      );
      if (!applied.matched) {
        onError(
          "업로드한 이미지를 편집 화면과 안전하게 연결할 수 없습니다. 새로고침 후 확인해 주세요.",
        );
        return false;
      }
      applied.previewsToRevoke.forEach((preview) => {
        revokeObjectUrl(preview);
      });
      const next = applied.items.map((item) => ({ ...item }));
      imageItemsRef.current = next;
      setImageItems(next);
      return true;
    },
    [onError, revokeObjectUrl],
  );

  const handleImageSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(event.target.files ?? []));
      event.target.value = "";
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      addFiles(Array.from(event.dataTransfer.files));
    },
    [addFiles],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
    setDragOverIndex(null);
  }, []);

  const handleDragOverItem = useCallback(
    (event: DragEvent, index: number) => {
      event.preventDefault();
      event.stopPropagation();
      if (
        draggedIndex !== null &&
        draggedIndex !== index &&
        dragOverIndex !== index
      ) {
        setDragOverIndex(index);
      }
    },
    [dragOverIndex, draggedIndex],
  );

  const handleDragEnd = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (
        draggedIndex !== null &&
        dragOverIndex !== null &&
        draggedIndex !== dragOverIndex
      ) {
        setImageItems((current) => {
          const next = reorderListingEditorImages(
            current,
            draggedIndex,
            dragOverIndex,
          ).map((item) => ({ ...item }));
          imageItemsRef.current = next;
          return next;
        });
      }
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [dragOverIndex, draggedIndex],
  );

  const getPendingFiles = useCallback(
    () => getPendingListingEditorFiles(imageItemsRef.current),
    [],
  );

  return {
    addFiles,
    applyUploaded,
    draggedIndex,
    dragOverIndex,
    getPendingFiles,
    handleDragEnd,
    handleDragOver,
    handleDragOverItem,
    handleDragStart,
    handleDrop,
    handleImageSelect,
    hydrate,
    imageItems,
    removeAt,
    restore,
    setUploadProgress,
    uploadProgress,
  };
};
