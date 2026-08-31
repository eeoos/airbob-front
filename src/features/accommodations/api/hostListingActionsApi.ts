import { requestApiDataNullable } from "../../../platform/http/request";
import type { HostListingActionsApiPort } from "../ports/hostListingActionsApiPort";

export type HostListingActionsApiTransport = typeof requestApiDataNullable;

export const createHostListingActionsApi = (
  requestNullable: HostListingActionsApiTransport = requestApiDataNullable,
): HostListingActionsApiPort => ({
  async delete(accommodationId, options) {
    await requestNullable({
      method: "DELETE",
      path: `/accommodations/${accommodationId}`,
      ...(options?.signal ? { signal: options.signal } : {}),
    });
  },

  async publish(accommodationId, options) {
    await requestNullable({
      method: "PATCH",
      path: `/accommodations/${accommodationId}/publish`,
      ...(options?.signal ? { signal: options.signal } : {}),
    });
  },

  async unpublish(accommodationId, options) {
    await requestNullable({
      method: "PATCH",
      path: `/accommodations/${accommodationId}/unpublish`,
      ...(options?.signal ? { signal: options.signal } : {}),
    });
  },
});

export const hostListingActionsApi = createHostListingActionsApi();
