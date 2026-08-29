import axios from "axios";
import type { AxiosError, AxiosInstance } from "axios";
import { triggerAuthError } from "../session/authEvents";
import { getApiBaseUrl } from "../config/publicRuntimeConfig";
import { isSessionOwnedAuthEventRequest } from "./authEventPolicy";
import { normalizeHttpError } from "./errors";

/**
 * The single production Axios instance. Its interceptor only publishes the
 * process-wide authentication signal and rejects the original failure.
 * Legacy callers therefore retain raw Axios errors, while migrated adapters
 * normalize at requestApiData.
 */
export const httpClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
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
