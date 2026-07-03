import { client } from "./client";
import { requestApi, requestApiNullable } from "./request";
import { ApiClientError } from "./response";
import {
  LoginRequest,
  SignupRequest,
  MeInfo,
} from "../types/auth";
import { ApiResponse } from "../types/api";

const INVALID_API_RESPONSE_ERROR = {
  message: "Invalid API Response",
  status: 500,
  code: "INVALID_API_RESPONSE",
};

export const authApi = {
  // 로그인
  login: async (request: LoginRequest): Promise<void> => {
    await requestApiNullable(() => client.post<ApiResponse<null>>("/auth/login", request));
  },

  // 회원가입
  signup: async (request: SignupRequest): Promise<void> => {
    await requestApiNullable(() => client.post<ApiResponse<null>>("/members", request));
  },

  // 로그아웃
  logout: async (): Promise<void> => {
    await requestApiNullable(() => client.post<ApiResponse<null>>("/auth/logout"));
  },

  // 내 정보 조회
  getMe: async (signal?: AbortSignal): Promise<MeInfo> => {
    const response = signal
      ? await client.get<ApiResponse<MeInfo>>("/auth/me", { signal })
      : await client.get<ApiResponse<MeInfo>>("/auth/me");
    const contentType = response.headers?.["content-type"];

    if (typeof contentType === "string" && contentType.toLowerCase().includes("text/html")) {
      throw new ApiClientError(INVALID_API_RESPONSE_ERROR);
    }

    return requestApi(() => Promise.resolve(response));
  },
};
