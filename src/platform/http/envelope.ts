import { AppError, createHttpAppError } from "./errors";

type UnknownRecord = Record<string, unknown>;

export type EnvelopeInspection<T> =
  | { readonly kind: "data"; readonly data: T | null }
  | { readonly kind: "backend-error"; readonly error: unknown }
  | { readonly kind: "invalid-response" }
  | { readonly kind: "empty-data" };

export interface InspectEnvelopeOptions {
  readonly allowNull?: boolean;
}

const isObjectEnvelope = (response: unknown): response is UnknownRecord =>
  typeof response === "object" && response !== null;

const hasOwnProperty = (response: UnknownRecord, property: string): boolean =>
  Object.prototype.hasOwnProperty.call(response, property);

/**
 * Classifies an API envelope without choosing an application error surface.
 * Feature adapters use the result through the canonical AppError boundary.
 */
export const inspectApiEnvelope = <T>(
  response: unknown,
  options: InspectEnvelopeOptions = {},
): EnvelopeInspection<T> => {
  if (!isObjectEnvelope(response) || typeof response.success !== "boolean") {
    return { kind: "invalid-response" };
  }

  if (response.success === false) {
    return { kind: "backend-error", error: response.error };
  }

  if (!hasOwnProperty(response, "data") || response.data === undefined) {
    return options.allowNull
      ? { kind: "data", data: null }
      : { kind: "invalid-response" };
  }

  if (response.data === null) {
    return options.allowNull
      ? { kind: "data", data: null }
      : { kind: "empty-data" };
  }

  return { kind: "data", data: response.data as T };
};

const getBackendErrorStatus = (error: unknown): number | undefined => {
  if (!isObjectEnvelope(error)) {
    return undefined;
  }

  return typeof error.status === "number" && Number.isFinite(error.status)
    ? error.status
    : undefined;
};

const getSafeBackendErrorCode = (error: unknown): string | undefined => {
  if (!isObjectEnvelope(error)) {
    return undefined;
  }

  return typeof error.code === "string" &&
    /^[A-Z][A-Z0-9_-]{0,63}$/.test(error.code)
    ? error.code
    : undefined;
};

const toEnvelopeAppError = (inspection: Exclude<EnvelopeInspection<never>, { kind: "data" }>) => {
  switch (inspection.kind) {
    case "backend-error":
      return createHttpAppError({
        status: getBackendErrorStatus(inspection.error) ?? 500,
        backendCode:
          getSafeBackendErrorCode(inspection.error) ?? "UNKNOWN_API_ERROR",
      });
    case "empty-data":
      return new AppError({
        kind: "empty-data",
        code: "EMPTY_API_DATA",
        message: "The API response contained no data.",
        status: 500,
      });
    case "invalid-response":
      return new AppError({
        kind: "invalid-response",
        code: "INVALID_API_RESPONSE",
        message: "The API response envelope is invalid.",
        status: 500,
      });
  }
};

export function parseApiEnvelope<T>(response: unknown): NonNullable<T>;
export function parseApiEnvelope<T>(
  response: unknown,
  options: { allowNull: true },
): T | null;
export function parseApiEnvelope<T>(
  response: unknown,
  options: { allowNull?: false },
): NonNullable<T>;
export function parseApiEnvelope<T>(
  response: unknown,
  options: InspectEnvelopeOptions = {},
): T | null {
  const inspection = inspectApiEnvelope<T>(response, options);

  if (inspection.kind === "data") {
    return inspection.data;
  }

  throw toEnvelopeAppError(inspection);
}
