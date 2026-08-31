import type { requestApiData } from "../../../platform/http/request";
import type {
  AccommodationDraft,
  AccommodationDraftApiPort,
} from "../ports/accommodationDraftApiPort";

export type AccommodationDraftApiTransport = typeof requestApiData;

export const createAccommodationDraftApi = (
  request: AccommodationDraftApiTransport,
): AccommodationDraftApiPort => ({
  create: () =>
    request<AccommodationDraft>({
      method: "POST",
      path: "/accommodations",
    }),
});
