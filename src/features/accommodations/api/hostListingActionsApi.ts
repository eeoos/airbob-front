import { requestApiDataNullable } from "../../../platform/http/request";

export type HostListingActionsApiTransport = typeof requestApiDataNullable;

export interface HostListingActionsApi {
  delete(accommodationId: number): Promise<void>;
  publish(accommodationId: number): Promise<void>;
  unpublish(accommodationId: number): Promise<void>;
}

export const createHostListingActionsApi = (
  requestNullable: HostListingActionsApiTransport = requestApiDataNullable,
): HostListingActionsApi => ({
  async delete(accommodationId) {
    await requestNullable({
      method: "DELETE",
      path: `/accommodations/${accommodationId}`,
    });
  },

  async publish(accommodationId) {
    await requestNullable({
      method: "PATCH",
      path: `/accommodations/${accommodationId}/publish`,
    });
  },

  async unpublish(accommodationId) {
    await requestNullable({
      method: "PATCH",
      path: `/accommodations/${accommodationId}/unpublish`,
    });
  },
});

export const hostListingActionsApi = createHostListingActionsApi();
