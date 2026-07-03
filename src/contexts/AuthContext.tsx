// src/contexts/AuthContext.tsx
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect, ReactNode, useCallback } from "react";
import { authApi } from "../api";
import { useSessionQuery } from "../features/auth/hooks/useSessionQuery";
import { authQueryKeys } from "../features/auth/queryKeys";
import { onAuthError } from "../utils/authEvents";
import { LoginRequest, MeInfo } from "../types/auth";

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
  const queryClient = useQueryClient();
  const sessionQuery = useSessionQuery();

  const clearSession = useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: authQueryKeys.me() });
    queryClient.setQueryData<MeInfo | null>(authQueryKeys.me(), null);
    queryClient.removeQueries({
      queryKey: authQueryKeys.me(),
      type: "inactive",
    });
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    try {
      const meInfo = await authApi.getMe();
      queryClient.setQueryData<MeInfo | null>(authQueryKeys.me(), meInfo);
    } catch (error) {
      await clearSession();
      throw error;
    }
  }, [clearSession, queryClient]);

  useEffect(() => {
    const handleAuthError = () => {
      console.warn("Session expired. Logging out...");
      void clearSession();
    };

    const unsubscribe = onAuthError(handleAuthError);
    return unsubscribe;
  }, [clearSession]);

  const checkAuth = useCallback(async () => {
    await refreshSession();
  }, [refreshSession]);

  const login = async (credentials: LoginRequest) => {
    await authApi.login(credentials);
    await queryClient.cancelQueries({ queryKey: authQueryKeys.me() });
    await refreshSession();
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      document.cookie = "SESSION_ID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      await clearSession();
    }
  };

  const isAuthenticated = sessionQuery.data != null;
  const isLoading = sessionQuery.isLoading;

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
