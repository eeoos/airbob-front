import { useEffect, useRef, useState } from "react";

export interface ReviewImageItem {
  file: File;
  id: string;
  previewUrl: string;
}

let imageId = 0;

export const useReviewImageSelection = () => {
  const [images, setImages] = useState<ReviewImageItem[]>([]);
  const activePreviewUrls = useRef(new Set<string>());

  const addFiles = (files: File[]) => {
    const nextItems = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      activePreviewUrls.current.add(previewUrl);

      return {
        file,
        id: `review-image-${imageId++}`,
        previewUrl,
      };
    });

    setImages((current) => [...current, ...nextItems]);
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const removed = current.find((item) => item.id === id);

      if (removed && activePreviewUrls.current.delete(removed.previewUrl)) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return current.filter((item) => item.id !== id);
    });
  };

  useEffect(
    () => () => {
      activePreviewUrls.current.forEach((previewUrl) => {
        URL.revokeObjectURL(previewUrl);
      });
      activePreviewUrls.current.clear();
    },
    [],
  );

  return { addFiles, images, removeImage, setImages };
};
