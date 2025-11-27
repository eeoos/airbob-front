import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { authApi } from "../api";
import { LoginRequest } from "../types/auth";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUnauthenticated: () => void; // 세션 만료 시 호출
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 전역 인증 상태 업데이트 함수 (interceptor에서 사용)
let globalSetUnauthenticated: (() => void) | null = null;

export const setAuthUnauthenticated = () => {
  if (globalSetUnauthenticated) {
    globalSetUnauthenticated();
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 세션 만료 시 인증 상태를 false로 설정하는 함수
  const setUnauthenticated = () => {
    setIsAuthenticated(false);
  };

  // 전역 함수 등록 (interceptor에서 사용)
  useEffect(() => {
    globalSetUnauthenticated = setUnauthenticated;
    return () => {
      globalSetUnauthenticated = null;
    };
  }, []);

  // 실제 API 호출로 세션 유효성 확인
  const checkAuth = useCallback(async () => {
    try {
      // 인증 확인 전용 API 호출
      const response = await fetch('/api/v1/auth/me', {
        method: 'GET',
        credentials: 'include', // 쿠키 포함
      });
      
      // 200 OK 또는 401 Unauthorized로 인증 상태 판단
      setIsAuthenticated(response.ok);
    } catch (error) {
      // 네트워크 에러 등
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 인증 상태 확인
  useEffect(() => {
    checkAuth();
  }, []);

  // 페이지 포커스 시 인증 상태 재확인 (세션 만료 감지)
  useEffect(() => {
    const handleFocus = () => {
      // 페이지가 다시 포커스를 받을 때 인증 상태 확인
      checkAuth();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkAuth]);

  const login = async (credentials: LoginRequest) => {
    try {
      await authApi.login(credentials);
      // 로그인 성공 시 쿠키가 자동으로 설정됨
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
      // 쿠키 삭제 (서버에서 처리되지만 클라이언트에서도 명시적으로 처리)
      document.cookie = "SESSION_ID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      setIsAuthenticated(false);
    } catch (error) {
      // 로그아웃 실패해도 클라이언트 상태는 업데이트
      document.cookie = "SESSION_ID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      setIsAuthenticated(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkAuth,
        setUnauthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


