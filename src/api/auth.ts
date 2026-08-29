import { client } from "./client";
import { requestApi, requestApiNullable } from "./request";
import { ApiClientError } from "./response";
import {
  LoginRequest,
  SignupRequest,
  MeInfo,
} from "../types/auth";
import { ApiResponse } from "../types/api";
import { sessionOwnedAuthEventPolicy } from "./authEventPolicy";

const INVALID_API_RESPONSE_ERROR = {
  message: "Invalid API Response",
  status: 500,
  code: "INVALID_API_RESPONSE",
};

const createSessionRequestConfig = (signal?: AbortSignal) => ({
  ...sessionOwnedAuthEventPolicy,
  ...(signal ? { signal } : {}),
});

export const authApi = {
  // 로그인
  login: async (request: LoginRequest, signal?: AbortSignal): Promise<void> => {
    const requestConfig = createSessionRequestConfig(signal);

    await requestApiNullable(
      () =>
        client.post<ApiResponse<null>>(
          "/auth/login",
          request,
          requestConfig,
        ),
      requestConfig,
    );
  },

  // 회원가입
  signup: async (request: SignupRequest): Promise<void> => {
    await requestApiNullable(() =>
      client.post<ApiResponse<null>>("/members", request),
    );
  },

  // 로그아웃
  logout: async (signal?: AbortSignal): Promise<void> => {
    const requestConfig = createSessionRequestConfig(signal);

    await requestApiNullable(
      () =>
        client.post<ApiResponse<null>>(
          "/auth/logout",
          undefined,
          requestConfig,
        ),
      requestConfig,
    );
  },

  // 내 정보 조회
  getMe: async (signal?: AbortSignal): Promise<MeInfo> => {
    const requestConfig = createSessionRequestConfig(signal);

    return requestApi(
      () =>
        client
          .get<ApiResponse<MeInfo>>("/auth/me", requestConfig)
          .then((response) => {
            const contentType = response.headers?.["content-type"];

            if (
              typeof contentType === "string" &&
              contentType.toLowerCase().includes("text/html")
            ) {
              throw new ApiClientError(INVALID_API_RESPONSE_ERROR);
            }

            return response;
          }),
      requestConfig,
    );
  },
};
