import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { triggerAuthError } from "../session/authEvents";
import type { AuthEventPolicy } from "./authEventPolicy";
import { isSessionOwnedAuthEventRequest } from "./authEventPolicy";
import {
  httpClient,
  MULTIPART_API_REQUEST_TIMEOUT_MS,
} from "./client";
import { parseApiEnvelope } from "./envelope";
import { AppError, normalizeHttpError } from "./errors";

export type ApiRequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiDataRequest {
  readonly method: ApiRequestMethod;
  readonly path: string;
  readonly body?: unknown;
  readonly bodyEncoding?: "multipart";
  readonly params?: object;
  readonly signal?: AbortSignal | undefined;
  readonly onUploadProgress?: (progress: number) => void;
  readonly authEventPolicy?: AuthEventPolicy;
}

const INVALID_API_RESPONSE = Object.freeze({
  kind: "invalid-response" as const,
  code: "INVALID_API_RESPONSE",
  message: "The API response is not JSON.",
  status: 500,
});

const isHtmlContentType = (response: AxiosResponse<unknown>): boolean => {
  const contentType = response.headers?.["content-type"];

  return (
    typeof contentType === "string" &&
    contentType.toLowerCase().includes("text/html")
  );
};

const toAxiosRequestConfig = ({
  authEventPolicy,
  body,
  bodyEncoding,
  method,
  onUploadProgress,
  params,
  path,
  signal,
}: ApiDataRequest): AxiosRequestConfig => ({
  ...(authEventPolicy ?? {}),
  ...(body === undefined ? {} : { data: body }),
  ...(bodyEncoding === "multipart"
    ? {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: MULTIPART_API_REQUEST_TIMEOUT_MS,
      }
    : {}),
  method,
  ...(params === undefined ? {} : { params }),
  ...(signal === undefined ? {} : { signal }),
  ...(onUploadProgress
    ? {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            onUploadProgress(
              Math.round((progressEvent.loaded * 100) / progressEvent.total),
            );
          }
        },
      }
    : {}),
  url: path,
});

const executeRequest = async (
  request: ApiDataRequest,
): Promise<AxiosResponse<unknown>> => {
  try {
    return await httpClient.request(toAxiosRequestConfig(request));
  } catch (error) {
    throw normalizeHttpError(error);
  }
};

const publishEnvelopeAuthErrorIfNeeded = (
  error: AppError,
  request: ApiDataRequest,
) => {
  if (
    error.kind === "authentication" &&
    !isSessionOwnedAuthEventRequest(request.authEventPolicy)
  ) {
    triggerAuthError();
  }
};

const parseResponse = <T>(
  response: AxiosResponse<unknown>,
  request: ApiDataRequest,
  allowNull: boolean,
): T | null => {
  try {
    if (isHtmlContentType(response)) {
      throw new AppError(INVALID_API_RESPONSE);
    }

    return allowNull
      ? parseApiEnvelope<T>(response.data, { allowNull: true })
      : parseApiEnvelope<T>(response.data);
  } catch (error) {
    const appError = normalizeHttpError(error);
    publishEnvelopeAuthErrorIfNeeded(appError, request);
    throw appError;
  }
};

/**
 * Canonical migrated API boundary. Feature adapters provide only transport
 * data and receive validated, non-null envelope data or a normalized AppError.
 */
export const requestApiData = async <T>(
  request: ApiDataRequest,
): Promise<NonNullable<T>> => {
  const response = await executeRequest(request);
  return parseResponse<T>(response, request, false) as NonNullable<T>;
};

/**
 * Command variant for endpoints whose successful envelope intentionally has
 * null or omitted data.
 */
export const requestApiDataNullable = async <T = null>(
  request: ApiDataRequest,
): Promise<T | null> => {
  const response = await executeRequest(request);
  return parseResponse<T>(response, request, true);
};
