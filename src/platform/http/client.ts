import axios from "axios";
import type { AxiosInstance } from "axios";
import { getApiBaseUrl } from "../config/publicRuntimeConfig";

/**
 * The single production Axios instance. It deliberately has no error-mapping
 * interceptor: legacy callers retain raw Axios failures, while migrated
 * adapters opt into normalizeHttpError at their own boundary.
 */
export const httpClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export const getHttpClient = (): AxiosInstance => httpClient;
