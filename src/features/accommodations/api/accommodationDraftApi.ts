import { requestApiData } from "../../../platform/http/request";
import type {
  AccommodationDraft,
  AccommodationDraftApiPort,
} from "../ports/accommodationDraftApiPort";

export type AccommodationDraftApiTransport = typeof requestApiData;

export const createAccommodationDraftApi = (
  request: AccommodationDraftApiTransport = requestApiData,
): AccommodationDraftApiPort => ({
  create: () =>
    request<AccommodationDraft>({
      method: "POST",
      path: "/accommodations",
    }),
});

export const accommodationDraftApi = createAccommodationDraftApi();
