import { createContext } from "react";
import type { SessionCredentials } from "../../features/auth/ports/sessionPort";
import type { AuthenticatedSessionScope, SessionState } from "./sessionState";

export interface SessionContextValue {
  readonly state: SessionState;
  login(credentials: SessionCredentials): Promise<void>;
  logout(): Promise<void>;
  revalidate(): Promise<void>;
  retryServerLogout(): Promise<void>;
  captureAuthenticatedSession(): AuthenticatedSessionScope | null;
  isCurrentSession(scope: AuthenticatedSessionScope): boolean;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
