import { triggerAuthError } from "../session/authEvents";
import type { AuthEventPolicy } from "./authEventPolicy";
import { isSessionOwnedAuthEventRequest } from "./authEventPolicy";
import {
  httpClient,
  type HttpClientRequest,
  type HttpClientResponse,
} from "./client";
import { parseApiEnvelope } from "./envelope";
import { AppError, normalizeHttpError } from "./errors";

type ApiRequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiDataRequest {
  readonly method: ApiRequestMethod;
  readonly path: string;
  /**
   * Narrows a successful command to the one HTTP status that carries its
   * protocol meaning. The value is validated by this API boundary and is not
   * forwarded to the native transport.
   */
  readonly expectedSuccessStatus?: number;
  readonly body?: unknown;
  readonly bodyEncoding?: "multipart";
  readonly idempotencyKey?: string;
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

const isHtmlContentType = (response: HttpClientResponse): boolean =>
  response.contentType?.toLowerCase().includes("text/html") ?? false;

const toHttpClientRequest = ({
  body,
  bodyEncoding,
  idempotencyKey,
  method,
  onUploadProgress,
  params,
  path,
  signal,
}: ApiDataRequest): HttpClientRequest => ({
  method,
  path,
  ...(body === undefined ? {} : { body }),
  ...(bodyEncoding === undefined ? {} : { bodyEncoding }),
  ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  ...(params === undefined ? {} : { params }),
  ...(signal === undefined ? {} : { signal }),
  ...(onUploadProgress === undefined ? {} : { onUploadProgress }),
});

const publishAuthErrorIfNeeded = (error: AppError, request: ApiDataRequest) => {
  if (
    error.kind === "authentication" &&
    !isSessionOwnedAuthEventRequest(request.authEventPolicy)
  ) {
    triggerAuthError();
  }
};

const executeRequest = async (
  request: ApiDataRequest,
): Promise<HttpClientResponse> => {
  try {
    const response = await httpClient.request(toHttpClientRequest(request));
    if (
      request.expectedSuccessStatus !== undefined &&
      response.status !== request.expectedSuccessStatus
    ) {
      throw new AppError({
        kind: "invalid-response",
        code: "UNEXPECTED_HTTP_STATUS",
        message: "The API response used an unexpected success status.",
        status: response.status,
      });
    }
    return response;
  } catch (error) {
    const appError = normalizeHttpError(error);
    publishAuthErrorIfNeeded(appError, request);
    throw appError;
  }
};

const parseResponse = <T>(
  response: HttpClientResponse,
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
    publishAuthErrorIfNeeded(appError, request);
    throw appError;
  }
};

/**
 * Canonical API boundary. Feature adapters provide only transport data and
 * receive validated, non-null envelope data or a normalized AppError.
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
