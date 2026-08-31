import {
  requestApiData,
  requestApiDataNullable,
} from "../../../../platform/http/request";

type AccommodationApiTransportRequest = Parameters<typeof requestApiData>[0];

export interface AccommodationApiTransport {
  request<T>(
    request: AccommodationApiTransportRequest,
  ): Promise<NonNullable<T>>;
  requestNullable<T>(
    request: AccommodationApiTransportRequest,
  ): Promise<T | null>;
}

export const platformAccommodationApiTransport: AccommodationApiTransport = {
  request: requestApiData,
  requestNullable: requestApiDataNullable,
};
