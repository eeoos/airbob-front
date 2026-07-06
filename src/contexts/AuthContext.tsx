// src/contexts/AuthContext.tsx
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect, ReactNode, useCallback } from "react";
import { authApi } from "../api";
import { useSessionQuery } from "../features/auth/hooks/useSessionQuery";
import { authQueryKeys } from "../features/auth/queryKeys";
import {
  clearSessionQueryData,
  refreshSessionQueryData,
} from "../query/sessionCacheBoundary";
import { clearAllReservationCheckoutState } from "../features/reservations/lib/reservationCheckoutState";
import { onAuthError } from "../utils/authEvents";
import { clientLogger } from "../utils/clientLogger";
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
  const queryClient = useQueryClient();
  const sessionQuery = useSessionQuery();

  const clearSession = useCallback(async () => {
    clearAllReservationCheckoutState();
    await clearSessionQueryData(queryClient);
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    try {
      const meInfo = await authApi.getMe();
      await refreshSessionQueryData(queryClient, meInfo);
    } catch (error) {
      await clearSession();
      throw error;
    }
  }, [clearSession, queryClient]);

  useEffect(() => {
    const handleAuthError = () => {
      clientLogger.warn({ message: "Session expired. Logging out..." });
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
    let logoutRequest: Promise<unknown>;

    try {
      logoutRequest = authApi.logout();
    } catch (error) {
      logoutRequest = Promise.reject(error);
    }

    try {
      await clearSession();
    } finally {
      try {
        await logoutRequest;
      } catch (error) {
        clientLogger.error({
          message: "Logout request failed after local session clear",
          error,
        });
      } finally {
        document.cookie = "SESSION_ID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }
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
