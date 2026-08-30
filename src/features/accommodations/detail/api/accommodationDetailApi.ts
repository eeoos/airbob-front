import { requestApiData } from "../../../../platform/http/request";
import type { AccommodationDetailApiPort } from "../ports/accommodationDetailApiPort";
import type { AccommodationDetailWire } from "./contracts";
import { toAccommodationDetail } from "./mappers";

export type AccommodationDetailApiTransport = typeof requestApiData;

export const createAccommodationDetailApi = (
  request: AccommodationDetailApiTransport,
): AccommodationDetailApiPort => ({
  async getDetail(accommodationId, options) {
    const wire = await request<AccommodationDetailWire>({
      method: "GET",
      path: `/accommodations/${accommodationId}`,
      signal: options?.signal,
    });

    return toAccommodationDetail(wire);
  },
});

export const accommodationDetailApi =
  createAccommodationDetailApi(requestApiData);
