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





