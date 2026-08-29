// src/contexts/AuthContext.tsx
import React, { createContext, useContext, type ReactNode } from "react";
import { useSession } from "../app/session/useSession";
import type { SessionCredentials } from "../features/auth/ports/sessionPort";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: SessionCredentials) => Promise<void>;
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
  const session = useSession();
  const isAuthenticated = session.state.status === "authenticated";
  const isLoading = session.state.status === "checking";

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login: session.login,
        logout: session.logout,
        checkAuth: session.revalidate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
