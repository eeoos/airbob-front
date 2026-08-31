import type { ReactNode } from "react";
import { authApi } from "../api/authApi";
import {
  AuthCommandProvider,
  type AuthCommandPort,
} from "./AuthCommandProvider";

interface AuthFeatureCommandProviderProps {
  readonly children: ReactNode;
  readonly login: AuthCommandPort["login"];
  readonly shouldCompleteLoginInCurrentView: AuthCommandPort["shouldCompleteLoginInCurrentView"];
}

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
