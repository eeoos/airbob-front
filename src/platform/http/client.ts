import axios from "axios";
import type { AxiosError, AxiosInstance } from "axios";
import { triggerAuthError } from "../session/authEvents";
import { getApiBaseUrl } from "../config/publicRuntimeConfig";
import { isSessionOwnedAuthEventRequest } from "./authEventPolicy";
import { normalizeHttpError } from "./errors";

export const API_REQUEST_TIMEOUT_MS = 30_000;
export const MULTIPART_API_REQUEST_TIMEOUT_MS = 5 * 60_000;

/**
 * The single production Axios instance. Its interceptor only publishes the
 * process-wide authentication signal and rejects the original failure.
 * Feature adapters normalize that failure at requestApiData.
 */
export const httpClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: API_REQUEST_TIMEOUT_MS,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (
      normalizeHttpError(error).kind === "authentication" &&
      !isSessionOwnedAuthEventRequest(error.config)
    ) {
      triggerAuthError();
    }

    return Promise.reject(error);
  },
);

export const getHttpClient = (): AxiosInstance => httpClient;
