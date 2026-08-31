import { createContext } from "react";
import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import type { AuthIntent, AuthIntentAttemptId } from "./authIntent";

export interface AuthIntentSource {
  readonly locationKey: string;
  readonly path: string;
}

export interface PendingAuthIntent<TIntent extends AuthIntent = AuthIntent> {
  readonly attemptId: AuthIntentAttemptId;
  readonly intent: TIntent;
  readonly source: AuthIntentSource;
}

export interface ClaimedAuthIntent<
  TIntent extends AuthIntent = AuthIntent,
> extends PendingAuthIntent<TIntent> {
  readonly session: AuthenticatedSessionScope;
}

export interface ClaimAuthIntent {
  <TIntent extends AuthIntent>(
    predicate: (intent: AuthIntent) => intent is TIntent,
  ): ClaimedAuthIntent<TIntent> | null;
  (predicate: (intent: AuthIntent) => boolean): ClaimedAuthIntent | null;
}

export interface AuthIntentContextValue {
  readonly pending: PendingAuthIntent | null;
  request(intent: AuthIntent): AuthIntentAttemptId;
  cancel(attemptId: AuthIntentAttemptId): boolean;
  claim: ClaimAuthIntent;
}

export const AuthIntentContext = createContext<AuthIntentContextValue | null>(
  null,
);
