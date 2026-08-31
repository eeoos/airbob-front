import type { AccommodationApiRequestOptions } from "../model/accommodationDetail";
import type { AccommodationAvailability } from "../model/accommodationAvailability";

export interface AccommodationAvailabilityApiPort {
  getAvailability(
    accommodationId: number,
    options?: AccommodationApiRequestOptions,
  ): Promise<AccommodationAvailability>;
}
