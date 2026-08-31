import { useCallback, useEffect, useRef, useState } from "react";

export interface ReviewImageItem {
  readonly file: File;
  readonly id: string;
  readonly previewUrl: string;
}

let nextImageId = 0;

export const useReviewImageSelection = () => {
  const [images, setImages] = useState<ReviewImageItem[]>([]);
  const activePreviewUrlsRef = useRef(new Set<string>());

  const addFiles = useCallback((files: readonly File[]) => {
    const nextItems = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      activePreviewUrlsRef.current.add(previewUrl);

      return {
        file,
        id: `review-image-${nextImageId++}`,
        previewUrl,
      };
    });

    setImages((current) => [...current, ...nextItems]);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed && activePreviewUrlsRef.current.delete(removed.previewUrl)) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return current.filter((item) => item.id !== id);
    });
  }, []);

  useEffect(
    () => () => {
      activePreviewUrlsRef.current.forEach((previewUrl) => {
        URL.revokeObjectURL(previewUrl);
      });
      activePreviewUrlsRef.current.clear();
    },
    [],
  );

  return { addFiles, images, removeImage };
};
