import { createContext, useContext, type ReactNode } from "react";
import { authApi } from "../api/authApi";
import type { LoginCredentials, SignupCommand } from "../model/auth";

export interface AuthCommandPort {
  login(credentials: LoginCredentials): Promise<void>;
  signup(command: SignupCommand): Promise<void>;
  shouldCompleteLoginInCurrentView(): boolean;
}

const AuthCommandContext = createContext<AuthCommandPort | null>(null);

export interface AuthCommandProviderProps {
  readonly children: ReactNode;
  readonly commands: AuthCommandPort;
}

export function AuthCommandProvider({
  children,
  commands,
}: AuthCommandProviderProps) {
  return (
    <AuthCommandContext.Provider value={commands}>
      {children}
    </AuthCommandContext.Provider>
  );
}

export interface AuthFeatureCommandProviderProps {
  readonly children: ReactNode;
  readonly login: AuthCommandPort["login"];
  readonly shouldCompleteLoginInCurrentView: AuthCommandPort["shouldCompleteLoginInCurrentView"];
}

/**
 * Composes the session-owned login command with the feature-owned signup
 * adapter. The caller injects commands only; this boundary owns no identity.
 */
export function AuthFeatureCommandProvider({
  children,
  login,
  shouldCompleteLoginInCurrentView,
}: AuthFeatureCommandProviderProps) {
  return (
    <AuthCommandProvider
      commands={{
        login,
        signup: authApi.signup,
        shouldCompleteLoginInCurrentView,
      }}
    >
      {children}
    </AuthCommandProvider>
  );
}

export const useAuthCommands = (): AuthCommandPort => {
  const commands = useContext(AuthCommandContext);

  if (!commands) {
    throw new Error(
      "useAuthCommands must be used within an AuthCommandProvider",
    );
  }

  return commands;
};
