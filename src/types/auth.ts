import { ApiResponse } from "./api";

// 로그인
export interface LoginRequest {
  email: string;
  password: string;
}

export type LoginResponse = ApiResponse<null>;

// 회원가입
export interface SignupRequest {
  nickname: string;
  email: string;
  password: string;
  thumbnail_image_url?: string;
}

export type SignupResponse = ApiResponse<null>;

// 로그아웃
export type LogoutResponse = ApiResponse<null>;

// 인증 확인 (내 정보 조회)
export interface MeInfo {
  id: number;
  email: string;
  nickname: string;
  thumbnail_image_url: string | null;
}

export type GetMeResponse = ApiResponse<MeInfo>;
