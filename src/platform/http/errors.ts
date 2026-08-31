import { HttpTransportFailure } from "./transportFailure";

export type AppErrorKind =
  | "cancelled"
  | "timeout"
  | "network"
  | "authentication"
  | "validation"
  | "conflict"
  | "server"
  | "http"
  | "invalid-response"
  | "empty-data"
  | "configuration"
  | "integration"
  | "storage"
  | "unknown";

export interface AppErrorOptions {
  readonly kind: AppErrorKind;
  readonly code: string;
  readonly message: string;
  readonly status?: number;
  readonly retryable?: boolean;
  readonly cause?: unknown;
}

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly code: string;
  readonly status: number | undefined;
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor({
    kind,
    code,
    message,
    status,
    retryable = false,
    cause,
  }: AppErrorOptions) {
    super(message);

    this.name = "AppError";
    this.kind = kind;
    this.code = code;
    this.status = status;
    this.retryable = retryable;

    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: false,
        enumerable: false,
        value: cause,
        writable: false,
      });
    }

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const getSafeBackendCodeFromFailureEnvelope = (
  data: unknown,
): string | undefined => {
  if (!isRecord(data) || data.success !== false || !isRecord(data.error)) {
    return undefined;
  }

  const code = data.error.code;

  return typeof code === "string" && /^[A-Z][A-Z0-9_-]{0,63}$/.test(code)
    ? code
    : undefined;
};

const isCancellation = (error: unknown): boolean =>
  isRecord(error) && error.name === "AbortError";

export interface HttpAppErrorOptions {
  readonly status?: number;
  readonly backendCode?: string;
  readonly cause?: unknown;
}

export const createHttpAppError = ({
  status,
  backendCode,
  cause,
}: HttpAppErrorOptions): AppError => {
  const safeStatus =
    typeof status === "number" && Number.isFinite(status) ? status : undefined;
  const safeBackendCode =
    typeof backendCode === "string" &&
    /^[A-Z][A-Z0-9_-]{0,63}$/.test(backendCode)
      ? backendCode
      : undefined;

  if (safeStatus === 401 || safeBackendCode === "M004") {
    return new AppError({
      kind: "authentication",
      code: safeBackendCode ?? "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
      ...(safeStatus === undefined ? {} : { status: safeStatus }),
      cause,
    });
  }

  if (safeStatus === 400 || safeStatus === 422) {
    return new AppError({
      kind: "validation",
      code: safeBackendCode ?? "VALIDATION_ERROR",
      message: "The request could not be validated.",
      status: safeStatus,
      cause,
    });
  }

  if (safeStatus === 409) {
    return new AppError({
      kind: "conflict",
      code: safeBackendCode ?? "CONFLICT",
      message: "The request conflicts with the current state.",
      status: safeStatus,
      cause,
    });
  }

  if (safeStatus !== undefined && safeStatus >= 500) {
    return new AppError({
      kind: "server",
      code: safeBackendCode ?? "SERVER_ERROR",
      message: "The server could not complete the request.",
      status: safeStatus,
      retryable: true,
      cause,
    });
  }

  return new AppError({
    kind: "http",
    code: safeBackendCode ?? "HTTP_ERROR",
    message: "The HTTP request failed.",
    ...(safeStatus === undefined ? {} : { status: safeStatus }),
    retryable: safeStatus === 408 || safeStatus === 429,
    cause,
  });
};

const normalizeTransportFailure = (error: HttpTransportFailure): AppError => {
  switch (error.kind) {
    case "cancelled":
      return new AppError({
        kind: "cancelled",
        code: "REQUEST_CANCELLED",
        message: "The request was cancelled.",
        cause: error,
      });
    case "configuration":
      return new AppError({
        kind: "configuration",
        code: "INVALID_REQUEST_CONFIGURATION",
        message: "The request configuration is invalid.",
        cause: error,
      });
    case "http": {
      const backendCode = getSafeBackendCodeFromFailureEnvelope(
        error.responseData,
      );

      return createHttpAppError({
        ...(error.status === undefined ? {} : { status: error.status }),
        ...(backendCode === undefined ? {} : { backendCode }),
        cause: error,
      });
    }
    case "network":
      return new AppError({
        kind: "network",
        code: "NETWORK_ERROR",
        message: "The network request failed.",
        retryable: true,
        cause: error,
      });
    case "timeout":
      return new AppError({
        kind: "timeout",
        code: "REQUEST_TIMEOUT",
        message: "The request timed out.",
        retryable: true,
        cause: error,
      });
  }
};

/** Converts every platform transport failure to the stable AppError surface. */
export const normalizeHttpError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (isCancellation(error)) {
    return new AppError({
      kind: "cancelled",
      code: "REQUEST_CANCELLED",
      message: "The request was cancelled.",
      cause: error,
    });
  }

  if (error instanceof HttpTransportFailure) {
    return normalizeTransportFailure(error);
  }

  return new AppError({
    kind: "unknown",
    code: "UNKNOWN_ERROR",
    message: "An unexpected error occurred.",
    cause: error,
  });
};
