import { authApi } from "../api/authApi";
import {
  createHttpAppError,
  isAppError,
  normalizeHttpError,
  type AppError,
} from "../../../platform/http/errors";
import type { AuthViewer, LoginCredentials } from "../model/auth";

export type SessionCredentials = LoginCredentials;
export type SessionViewer = AuthViewer;

export interface SessionAuthPort {
  getViewer(signal?: AbortSignal): Promise<SessionViewer>;
  login(credentials: SessionCredentials, signal?: AbortSignal): Promise<void>;
  logout(signal?: AbortSignal): Promise<void>;
}

export const normalizeSessionAuthError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const status = "status" in error ? error.status : undefined;
    const backendCode = "code" in error ? error.code : undefined;

    if (
      (typeof status === "number" && Number.isFinite(status)) ||
      typeof backendCode === "string"
    ) {
      return createHttpAppError({
        ...(typeof status === "number" ? { status } : {}),
        ...(typeof backendCode === "string" ? { backendCode } : {}),
        cause: error,
      });
    }
  }

  return normalizeHttpError(error);
};

export const isSessionAuthenticationError = (error: unknown): boolean =>
  normalizeSessionAuthError(error).kind === "authentication";

export const sessionAuthPort: SessionAuthPort = {
  getViewer: (signal) => authApi.getViewer(signal),
  login: (credentials, signal) => authApi.login(credentials, signal),
  logout: (signal) => authApi.logout(signal),
};
