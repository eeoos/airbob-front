import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { isAuthError } from "../utils/error";

// 개발 환경에서는 프록시를 사용하므로 상대 경로 사용
// 프로덕션에서는 환경 변수 사용
const getBaseURL = () => {
  if (process.env.NODE_ENV === 'development') {
    // 개발 환경: 프록시 사용 (package.json의 proxy 설정)
    return '/api/v1';
  }
  // 프로덕션 환경: 환경 변수 사용
  return process.env.REACT_APP_API_URL || 'http://localhost:8080/api/v1';
};

export const client = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true, // 인증 쿠키 등 필요한 경우
});

// Request 인터셉터
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 요청 전 처리 (필요시 헤더 추가 등)
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response 인터셉터
client.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    // 인증 에러인 경우 처리
    if (isAuthError(error)) {
      // 인증 실패 시 로그인 페이지로 리다이렉트 (필요시)
      // window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);
