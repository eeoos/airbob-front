// src/api/client.ts
import type { AxiosError } from "axios";
import { httpClient } from "../platform/http/client";
import { normalizeHttpError } from "../platform/http/errors";
import { triggerAuthError } from "../utils/authEvents";
import { isSessionOwnedAuthEventRequest } from "./authEventPolicy";

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

export const client = httpClient;
export const clientV1 = client;
