import { sessionOwnedAuthEventPolicy } from "../../../platform/http/authEventPolicy";
import {
  requestApiData,
  requestApiDataNullable,
} from "../../../platform/http/request";
import type {
  AuthViewer,
  LoginCredentials,
  SignupCommand,
} from "../model/auth";
import { toAuthViewer } from "./authMapper";
import type { AuthViewerWire } from "./wire";

export interface AuthApi {
  login(
    credentials: LoginCredentials,
    signal?: AbortSignal,
  ): Promise<void>;
  signup(command: SignupCommand, signal?: AbortSignal): Promise<void>;
  logout(signal?: AbortSignal): Promise<void>;
  getViewer(signal?: AbortSignal): Promise<AuthViewer>;
}

export const authApi: AuthApi = {
  async login(credentials, signal) {
    await requestApiDataNullable({
      method: "POST",
      path: "/auth/login",
      body: credentials,
      signal,
      authEventPolicy: sessionOwnedAuthEventPolicy,
    });
  },

  async signup(command, signal) {
    await requestApiDataNullable({
      method: "POST",
      path: "/members",
      body: command,
      signal,
    });
  },

  async logout(signal) {
    await requestApiDataNullable({
      method: "POST",
      path: "/auth/logout",
      signal,
      authEventPolicy: sessionOwnedAuthEventPolicy,
    });
  },

  async getViewer(signal) {
    const viewer = await requestApiData<AuthViewerWire>({
      method: "GET",
      path: "/auth/me",
      signal,
      authEventPolicy: sessionOwnedAuthEventPolicy,
    });

    return toAuthViewer(viewer);
  },
};
