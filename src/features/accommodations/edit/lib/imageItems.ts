import { ImageInfo } from "../../../../types/accommodation";

export interface AccommodationEditImageItem {
  id?: number;
  url: string;
  file?: File;
  preview?: string;
  tempId?: string;
}

export interface ImageValidationResult {
  validFiles: File[];
  errors: string[];
}

export interface PendingImageItemInput {
  file: File;
  preview: string;
  tempId: string;
}

export type HostImageItemInput = ImageInfo & {
  tempId: string;
};

export interface RemoveImageItemResult {
  nextItems: AccommodationEditImageItem[];
  removedItem?: AccommodationEditImageItem;
  previewToRevoke?: string;
  imageIdToDelete?: number;
}

export interface ApplyUploadedImagesResult {
  items: AccommodationEditImageItem[];
  previewsToRevoke: string[];
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

export const filterValidImageFiles = (files: File[]): ImageValidationResult => {
  const validFiles: File[] = [];
  const errors: string[] = [];

  files.forEach((file) => {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      errors.push(`${file.name} 파일 크기는 10MB를 초과할 수 없습니다.`);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      errors.push(`${file.name}은(는) 지원하지 않는 이미지 형식입니다.`);
      return;
    }

    validFiles.push(file);
  });

  return { validFiles, errors };
};

export const createImageItems = (
  inputs: PendingImageItemInput[]
): AccommodationEditImageItem[] => {
  return inputs.map(({ file, preview, tempId }) => ({
    file,
    url: "",
    preview,
    tempId,
  }));
};

export const mapHostImagesToImageItems = (
  images: HostImageItemInput[]
): AccommodationEditImageItem[] => {
  return images.map((image) => ({
    id: image.id,
    url: image.image_url,
    tempId: image.tempId,
  }));
};

export const removeImageItem = (
  items: AccommodationEditImageItem[],
  index: number
): RemoveImageItemResult => {
  const removedItem = items[index];
  const result: RemoveImageItemResult = {
    nextItems: items.filter((_, itemIndex) => itemIndex !== index),
  };

  if (!removedItem) {
    return result;
  }

  result.removedItem = removedItem;
  if (removedItem.preview) {
    result.previewToRevoke = removedItem.preview;
  }
  if (removedItem.id) {
    result.imageIdToDelete = removedItem.id;
  }

  return result;
};

export const reorderImageItems = (
  items: AccommodationEditImageItem[],
  fromIndex: number,
  toIndex: number
): AccommodationEditImageItem[] => {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }

  const nextItems = [...items];
  const [draggedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, draggedItem);
  return nextItems;
};

export const getPendingUploadFiles = (
  items: AccommodationEditImageItem[]
): File[] => items.filter((item) => item.file && !item.id).map((item) => item.file!);

export const applyUploadedImagesToItems = (
  items: AccommodationEditImageItem[],
  uploadedImages: ImageInfo[]
): ApplyUploadedImagesResult => {
  const nextItems = [...items];
  const previewsToRevoke: string[] = [];

  uploadedImages.forEach((uploadedImage) => {
    const index = nextItems.findIndex((item) => item.file && !item.id);
    if (index === -1) {
      return;
    }

    const item = nextItems[index];
    if (item.preview) {
      previewsToRevoke.push(item.preview);
    }

    nextItems[index] = {
      id: uploadedImage.id,
      url: uploadedImage.image_url,
      tempId: item.tempId,
    };
  });

  return {
    items: nextItems,
    previewsToRevoke,
  };
};
