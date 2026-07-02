import { ApiResponse, ErrorResponse } from "../types/api";

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
  if (response.success === false) {
    throw new ApiClientError(response.error ?? FALLBACK_ERROR);
  }

  if (response.data === null) {
    if (options?.allowNull === true) {
      return null;
    }

    throw new ApiClientError(EMPTY_DATA_ERROR);
  }

  return response.data;
}
