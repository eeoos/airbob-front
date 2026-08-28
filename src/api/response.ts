import { ApiResponse, ErrorResponse } from "../types/api";
import { inspectApiEnvelope } from "../platform/http/envelope";

const EMPTY_DATA_ERROR: ErrorResponse = {
  message: "응답 데이터가 비어 있습니다.",
  status: 500,
  code: "EMPTY_API_DATA",
};

const FALLBACK_ERROR: ErrorResponse = {
  message: "요청 처리 중 오류가 발생했습니다.",
  status: 500,
  code: "UNKNOWN_API_ERROR",
};

const INVALID_API_RESPONSE_ERROR: ErrorResponse = {
  message: "Invalid API Response",
  status: 500,
  code: "INVALID_API_RESPONSE",
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: ErrorResponse["errors"];

  constructor(error: ErrorResponse) {
    super(error.message);

    this.name = "ApiClientError";
    this.status = error.status;
    this.code = error.code;
    this.errors = error.errors;

    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function toErrorResponse(error: ApiClientError): ErrorResponse {
  const errorResponse: ErrorResponse = {
    message: error.message,
    status: error.status,
    code: error.code,
  };

  if (error.errors) {
    errorResponse.errors = error.errors;
  }

  return errorResponse;
}

function throwInvalidApiResponse(): never {
  throw new ApiClientError(INVALID_API_RESPONSE_ERROR);
}

export function unwrapApiResponse<T>(response: ApiResponse<T>): NonNullable<T>;
export function unwrapApiResponse<T>(
  response: ApiResponse<T>,
  options: { allowNull: true }
): T | null;
export function unwrapApiResponse<T>(
  response: ApiResponse<T>,
  options: { allowNull?: false }
): NonNullable<T>;
export function unwrapApiResponse<T>(
  response: ApiResponse<T>,
  options?: { allowNull?: boolean }
): T | null {
  const inspection = inspectApiEnvelope<T>(response, options);

  switch (inspection.kind) {
    case "data":
      return inspection.data;
    case "backend-error":
      throw new ApiClientError(
        (inspection.error as ErrorResponse | null | undefined) ?? FALLBACK_ERROR
      );
    case "empty-data":
      throw new ApiClientError(EMPTY_DATA_ERROR);
    case "invalid-response":
      throwInvalidApiResponse();
  }
}
