import { AxiosError } from "axios";
import { client } from "./client";
import { LoginRequest, LoginResponse, SignupRequest, SignupResponse, LogoutResponse } from "../types/auth";
import { ApiResponse } from "../types/api";

export const authApi = {
  // 로그인
  login: async (request: LoginRequest): Promise<void> => {
    try {
      const response = await client.post<ApiResponse<null>>("/auth/login", request);
      
      // 응답 데이터 확인
      if (!response.data) {
        const error = new AxiosError(
          "서버로부터 응답을 받지 못했습니다.",
          "LOGIN_FAILED",
          undefined,
          undefined,
          {
            data: null,
            status: 500,
          } as any
        );
        throw error;
      }

      // 성공 응답인 경우
      if (response.data.success) {
        return; // 성공
      }

      // 실패 응답인 경우
      const error = new AxiosError(
        response.data.error?.message || "로그인에 실패했습니다.",
        "LOGIN_FAILED",
        undefined,
        undefined,
        {
          data: response.data,
          status: response.data.error?.status || 400,
        } as any
      );
      throw error;
    } catch (error) {
      // Axios 에러인 경우 (네트워크 에러, HTTP 에러 등)
      if (error instanceof AxiosError) {
        // 이미 response.data가 ApiResponse 형식인 경우
        if (error.response?.data && typeof error.response.data === 'object' && 'success' in error.response.data) {
          const apiResponse = error.response.data as ApiResponse<null>;
          if (!apiResponse.success && apiResponse.error) {
            // 백엔드 에러 응답을 그대로 throw
            throw error;
          }
        }
        // 네트워크 에러나 기타 Axios 에러
        throw error;
      }
      // 기타 에러
      throw new AxiosError(
        error instanceof Error ? error.message : "로그인에 실패했습니다.",
        "LOGIN_FAILED"
      );
    }
  },

  // 회원가입
  signup: async (request: SignupRequest): Promise<void> => {
    try {
      const response = await client.post<ApiResponse<null>>("/members", request);
      
      // 응답 데이터 확인
      if (!response.data) {
        const error = new AxiosError(
          "서버로부터 응답을 받지 못했습니다.",
          "SIGNUP_FAILED",
          undefined,
          undefined,
          {
            data: null,
            status: 500,
          } as any
        );
        throw error;
      }

      // 성공 응답인 경우
      if (response.data.success) {
        return; // 성공
      }

      // 실패 응답인 경우
      const error = new AxiosError(
        response.data.error?.message || "회원가입에 실패했습니다.",
        "SIGNUP_FAILED",
        undefined,
        undefined,
        {
          data: response.data,
          status: response.data.error?.status || 400,
        } as any
      );
      throw error;
    } catch (error) {
      // Axios 에러인 경우 (네트워크 에러, HTTP 에러 등)
      if (error instanceof AxiosError) {
        // 이미 response.data가 ApiResponse 형식인 경우
        if (error.response?.data && typeof error.response.data === 'object' && 'success' in error.response.data) {
          const apiResponse = error.response.data as ApiResponse<null>;
          if (!apiResponse.success && apiResponse.error) {
            // 백엔드 에러 응답을 그대로 throw
            throw error;
          }
        }
        // 네트워크 에러나 기타 Axios 에러
        throw error;
      }
      // 기타 에러
      throw new AxiosError(
        error instanceof Error ? error.message : "회원가입에 실패했습니다.",
        "SIGNUP_FAILED"
      );
    }
  },

  // 로그아웃
  logout: async (): Promise<void> => {
    const response = await client.post<ApiResponse<null>>("/auth/logout");
    if (!response.data.success) {
      const error = new AxiosError(
        response.data.error?.message || "로그아웃에 실패했습니다.",
        "LOGOUT_FAILED",
        undefined,
        undefined,
        {
          data: response.data,
          status: response.data.error?.status || 400,
        } as any
      );
      throw error;
    }
  },
};

