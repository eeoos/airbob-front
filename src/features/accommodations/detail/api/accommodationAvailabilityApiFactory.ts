import type { requestApiData } from "../../../../platform/http/request";
import type { AccommodationAvailabilityApiPort } from "../ports/accommodationAvailabilityApiPort";
import { toAccommodationAvailability } from "./mappers";

export type AccommodationAvailabilityApiTransport = typeof requestApiData;

export const createAccommodationAvailabilityApi = (
  request: AccommodationAvailabilityApiTransport,
): AccommodationAvailabilityApiPort => ({
  async getAvailability(accommodationId, options) {
    const wire = await request<unknown>({
      method: "GET",
      path: `/accommodations/${accommodationId}/availability`,
      signal: options?.signal,
    });

    return toAccommodationAvailability(wire, accommodationId);
  },
});
