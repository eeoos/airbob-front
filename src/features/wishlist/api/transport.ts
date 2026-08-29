import {
  requestApiData,
  requestApiDataNullable,
} from "../../../platform/http/request";

export type ApiTransportRequest = Parameters<typeof requestApiData>[0];

export interface ApiTransport {
  request<T>(request: ApiTransportRequest): Promise<NonNullable<T>>;
  requestNullable<T>(request: ApiTransportRequest): Promise<T | null>;
}

export const platformApiTransport: ApiTransport = {
  request: requestApiData,
  requestNullable: requestApiDataNullable,
};
