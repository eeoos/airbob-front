// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { authApi } from "../api";
import { onAuthError } from "../utils/authEvents"; // [수정] 이벤트 구독 함수
import { LoginRequest } from "../types/auth";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  // [핵심 변경] 전역 인증 에러 이벤트 구독
  useEffect(() => {
    const handleAuthError = () => {
      console.warn("Session expired. Logging out...");
      setIsAuthenticated(false);
      // 필요하다면 여기서 토스트 메시지를 띄우거나 리다이렉트 처리를 추가할 수 있습니다.
    };

    // 구독 시작 (unsubscribe 함수를 반환받음)
    const unsubscribe = onAuthError(handleAuthError);

    // 컴포넌트 언마운트 시 구독 해제 (cleanup)
    return unsubscribe;
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      await authApi.getMe();
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 로딩 및 포커스 시 체크
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handleFocus = () => checkAuth();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkAuth]);

  const login = async (credentials: LoginRequest) => {
    try {
      await authApi.login(credentials);
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
      document.cookie = "SESSION_ID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      setIsAuthenticated(false);
    } catch (error) {
      document.cookie = "SESSION_ID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      setIsAuthenticated(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
