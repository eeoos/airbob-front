import type { ListingEditorImage } from "./listingEditor";

export interface ListingEditorImageItem {
  readonly clientId: string;
  readonly id?: number;
  readonly url: string;
  readonly file?: File;
  readonly preview?: string;
}

export interface ListingEditorImageTombstone {
  readonly image: ListingEditorImageItem;
  readonly originalIndex: number;
}

export interface ListingEditorImageValidation {
  readonly validFiles: readonly File[];
  readonly errors: readonly string[];
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export const validateListingEditorImageFiles = (
  files: readonly File[],
): ListingEditorImageValidation => {
  const validFiles: File[] = [];
  const errors: string[] = [];

  files.forEach((file) => {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      errors.push(`${file.name} 파일 크기는 10MB를 초과할 수 없습니다.`);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      errors.push(`${file.name}은(는) 지원하지 않는 이미지 형식입니다.`);
      return;
    }
    validFiles.push(file);
  });

  return { validFiles, errors };
};

export const toListingEditorImageItems = (
  images: readonly ListingEditorImage[],
): readonly ListingEditorImageItem[] =>
  images.map((image) => ({
    clientId: `server:${image.id}`,
    id: image.id,
    url: image.imageUrl,
  }));

export const createPendingListingEditorImageItems = (
  inputs: readonly {
    readonly clientId: string;
    readonly file: File;
    readonly preview: string;
  }[],
): readonly ListingEditorImageItem[] =>
  inputs.map((input) => ({
    clientId: input.clientId,
    file: input.file,
    preview: input.preview,
    url: "",
  }));

export const removeListingEditorImage = (
  items: readonly ListingEditorImageItem[],
  index: number,
): {
  readonly items: readonly ListingEditorImageItem[];
  readonly tombstone: ListingEditorImageTombstone | null;
} => {
  const image = items[index];
  if (!image) return { items: [...items], tombstone: null };

  return {
    items: items.filter((_, itemIndex) => itemIndex !== index),
    tombstone: { image, originalIndex: index },
  };
};

export const restoreListingEditorImage = (
  items: readonly ListingEditorImageItem[],
  tombstone: ListingEditorImageTombstone,
): readonly ListingEditorImageItem[] => {
  if (items.some((item) => item.clientId === tombstone.image.clientId)) {
    return items;
  }

  const next = [...items];
  next.splice(
    Math.min(Math.max(tombstone.originalIndex, 0), next.length),
    0,
    tombstone.image,
  );
  return next;
};

export const reorderListingEditorImages = (
  items: readonly ListingEditorImageItem[],
  fromIndex: number,
  toIndex: number,
): readonly ListingEditorImageItem[] => {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }

  const next = [...items];
  const [dragged] = next.splice(fromIndex, 1);
  if (!dragged) return [...items];

  next.splice(toIndex, 0, dragged);
  return next;
};

export const getPendingListingEditorFiles = (
  items: readonly ListingEditorImageItem[],
): readonly File[] =>
  items.flatMap((item) => (item.file && !item.id ? [item.file] : []));

export const applyUploadedListingEditorImages = (
  items: readonly ListingEditorImageItem[],
  uploaded: readonly ListingEditorImage[],
): {
  readonly items: readonly ListingEditorImageItem[];
  readonly previewsToRevoke: readonly string[];
  readonly matched: boolean;
} => {
  const pending = items.filter((item) => item.file && !item.id);
  if (pending.length !== uploaded.length) {
    return { items, previewsToRevoke: [], matched: false };
  }

  const byClientId = new Map(
    pending.map((item, index) => [item.clientId, uploaded[index]] as const),
  );
  const previewsToRevoke: string[] = [];
  const next = items.map((item) => {
    const image = byClientId.get(item.clientId);
    if (!image) return item;
    if (item.preview) previewsToRevoke.push(item.preview);

    return {
      clientId: item.clientId,
      id: image.id,
      url: image.imageUrl,
    };
  });

  return { items: next, previewsToRevoke, matched: true };
};
