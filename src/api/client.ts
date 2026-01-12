// src/api/client.ts
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { isAuthError } from "../utils/error";
import { triggerAuthError } from "../utils/authEvents"; // [수정] 이벤트 유틸 import

// 환경 변수에서 도메인만 가져옴 (예: https://api.airbob.cloud)
const API_DOMAIN = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const getBaseURL = (version: string) => {
  if (process.env.NODE_ENV === 'development') {
    // 개발 환경: Proxy 사용
    return `/api/${version}`;
  }
  // 운영 환경: 도메인 뒤에 슬래시가 있든 없든 안전하게 처리
  const cleanDomain = API_DOMAIN.replace(/\/+$/, '');
  return `${cleanDomain}/api/${version}`;
};

const createClient = (version: string): AxiosInstance => {
  const instance = axios.create({
    baseURL: getBaseURL(version),
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' }
  });

  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => config,
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      // 인증 에러(401) 감지 시 이벤트 트리거
      if (isAuthError(error)) {
        triggerAuthError();
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// V1 클라이언트 (기본)
export const client = createClient('v1');
// 확장성을 위한 명시적 export
export const clientV1 = client;
export const clientV2 = createClient('v2');