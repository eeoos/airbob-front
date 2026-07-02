import { AccommodationEditImageItem } from "./imageItems";

export interface AccommodationEditAmenityInfo {
  name: string;
  count: number;
}

interface ImageDirtyOptions {
  isNewDraft: boolean;
  currentImageItems: AccommodationEditImageItem[];
  initialImageItems: AccommodationEditImageItem[];
}

const sortAmenities = (items: AccommodationEditAmenityInfo[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

export const areAmenityInfosChanged = (
  current: AccommodationEditAmenityInfo[],
  initial: AccommodationEditAmenityInfo[]
) => JSON.stringify(sortAmenities(current)) !== JSON.stringify(sortAmenities(initial));

const comparableImages = (items: AccommodationEditImageItem[]) =>
  items
    .map((item) => ({ id: item.id, url: item.url }))
    .sort((a, b) => (a.id || 0) - (b.id || 0));

export const areImageItemsChanged = ({
  isNewDraft,
  currentImageItems,
  initialImageItems,
}: ImageDirtyOptions): boolean => {
  if (isNewDraft || initialImageItems.length === 0) {
    return false;
  }

  return (
    JSON.stringify(comparableImages(currentImageItems)) !==
    JSON.stringify(comparableImages(initialImageItems))
  );
};
