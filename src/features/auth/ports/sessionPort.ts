import { authApi } from "../../../api/auth";
import {
  createHttpAppError,
  normalizeHttpError,
  type AppError,
} from "../../../platform/http/errors";
import { isApiClientError } from "../../../api/response";
import type { LoginRequest, MeInfo } from "../../../types/auth";

export type SessionCredentials = LoginRequest;
export type SessionViewer = MeInfo;

export interface SessionAuthPort {
  getViewer(signal?: AbortSignal): Promise<SessionViewer>;
  login(credentials: SessionCredentials, signal?: AbortSignal): Promise<void>;
  logout(signal?: AbortSignal): Promise<void>;
}

export const normalizeSessionAuthError = (error: unknown): AppError => {
  if (isApiClientError(error)) {
    return createHttpAppError({
      status: error.status,
      backendCode: error.code,
      cause: error,
    });
  }

  return normalizeHttpError(error);
};

export const isSessionAuthenticationError = (error: unknown): boolean =>
  normalizeSessionAuthError(error).kind === "authentication";

export const sessionAuthPort: SessionAuthPort = {
  getViewer: (signal) => authApi.getMe(signal),
  login: (credentials, signal) => authApi.login(credentials, signal),
  logout: (signal) => authApi.logout(signal),
};
