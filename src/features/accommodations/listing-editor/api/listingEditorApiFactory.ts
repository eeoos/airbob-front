import type { ApiDataRequest } from "../../../../platform/http/request";
import type { ListingEditorApiPort } from "../ports/listingEditorApiPort";
import type {
  ListingEditorAccommodationWire,
  ListingEditorUploadedImagesWire,
} from "./listingEditorContracts";
import {
  toListingEditorAccommodation,
  toListingEditorImage,
  toListingEditorUpdateWire,
} from "./listingEditorMappers";

export interface ListingEditorApiTransport {
  request<T>(request: ApiDataRequest): Promise<NonNullable<T>>;
  requestNullable<T>(request: ApiDataRequest): Promise<T | null>;
}

export const createListingEditorApi = (
  transport: ListingEditorApiTransport,
): ListingEditorApiPort => ({
  async getHostDetail(accommodationId, options) {
    const wire = await transport.request<ListingEditorAccommodationWire>({
      method: "GET",
      path: `/profile/host/accommodations/${accommodationId}`,
      signal: options?.signal,
    });

    return toListingEditorAccommodation(wire);
  },

  async update(accommodationId, input, options) {
    await transport.requestNullable({
      method: "PATCH",
      path: `/accommodations/${accommodationId}`,
      body: toListingEditorUpdateWire(input),
      signal: options?.signal,
    });
  },

  async uploadImages(accommodationId, images, options) {
    const body = new FormData();
    images.forEach((image) => body.append("images", image));
    const wire = await transport.request<ListingEditorUploadedImagesWire>({
      method: "POST",
      path: `/accommodations/${accommodationId}/images`,
      body,
      bodyEncoding: "multipart",
      ...(options?.onProgress === undefined
        ? {}
        : { onUploadProgress: options.onProgress }),
      signal: options?.signal,
    });

    return wire.uploaded_images.map(toListingEditorImage);
  },

  async deleteImage(accommodationId, imageId, options) {
    await transport.requestNullable({
      method: "DELETE",
      path: `/accommodations/${accommodationId}/images/${imageId}`,
      signal: options?.signal,
    });
  },

  async publish(accommodationId, options) {
    await transport.requestNullable({
      method: "PATCH",
      path: `/accommodations/${accommodationId}/publish`,
      signal: options?.signal,
    });
  },
});
