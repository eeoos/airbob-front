import type {
  ListingEditorAccommodation,
  ListingEditorImage,
  ListingEditorUpdateInput,
} from "../model/listingEditor";

export type {
  ListingEditorAccommodation,
  ListingEditorImage,
  ListingEditorUpdateInput,
} from "../model/listingEditor";

export interface ListingEditorRequestOptions {
  readonly signal?: AbortSignal;
}

export interface ListingEditorUploadOptions extends ListingEditorRequestOptions {
  readonly onProgress?: (progress: number) => void;
}

export interface ListingEditorApiPort {
  getHostDetail(
    accommodationId: number,
    options?: ListingEditorRequestOptions,
  ): Promise<ListingEditorAccommodation>;
  update(
    accommodationId: number,
    input: ListingEditorUpdateInput,
    options?: ListingEditorRequestOptions,
  ): Promise<void>;
  uploadImages(
    accommodationId: number,
    images: readonly File[],
    options?: ListingEditorUploadOptions,
  ): Promise<readonly ListingEditorImage[]>;
  deleteImage(
    accommodationId: number,
    imageId: number,
    options?: ListingEditorRequestOptions,
  ): Promise<void>;
  publish(
    accommodationId: number,
    options?: ListingEditorRequestOptions,
  ): Promise<void>;
}
