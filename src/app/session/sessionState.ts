import type { SessionViewer } from "../../features/auth/ports/sessionPort";
import type { AppError } from "../../platform/http/errors";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";

export type { SessionViewer } from "../../features/auth/ports/sessionPort";
export type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";

export type SessionCheckingReason =
  "bootstrap" | "external-change" | "identity-change";

export type SessionAnonymousReason = "bootstrap" | "logout" | "server-revoked";

export type SessionRevocation = "verified" | "unverified";

export type SessionRevalidation =
  | { readonly status: "idle" }
  | {
      readonly status: "checking";
      readonly operationId: number;
    }
  | {
      readonly status: "error";
      readonly operationId: number;
      readonly error: AppError;
    };

export interface SessionCheckingState {
  readonly status: "checking";
  readonly reason: SessionCheckingReason;
  readonly operationId: number;
  readonly epoch: number;
}

export interface SessionAuthenticatedState {
  readonly status: "authenticated";
  readonly viewer: SessionViewer;
  readonly subject: SessionSubject;
  readonly epoch: number;
  readonly revalidation: SessionRevalidation;
}

export interface SessionAnonymousState {
  readonly status: "anonymous";
  readonly reason: SessionAnonymousReason;
  readonly revocation: SessionRevocation;
  readonly operationId: number;
  readonly epoch: number;
  readonly revocationError?: AppError;
}

export interface SessionErrorState {
  readonly status: "error";
  readonly reason: SessionCheckingReason;
  readonly operationId: number;
  readonly epoch: number;
  readonly error: AppError;
  readonly retryable: true;
}

export type SessionState =
  | SessionCheckingState
  | SessionAuthenticatedState
  | SessionAnonymousState
  | SessionErrorState;

interface InitialSessionStateOptions {
  readonly operationId: number;
  readonly epoch?: number;
}

export const createInitialSessionState = ({
  operationId,
  epoch = 0,
}: InitialSessionStateOptions): SessionCheckingState => ({
  status: "checking",
  reason: "bootstrap",
  operationId,
  epoch,
});

export const toSessionSubject = (viewer: SessionViewer): SessionSubject => {
  if (!Number.isSafeInteger(viewer.id) || viewer.id < 1) {
    throw new TypeError("Session viewer id must be a positive safe integer.");
  }

  return `subject:member_${viewer.id.toString(36)}` as SessionSubject;
};

export const toAuthenticatedSessionScope = (
  state: SessionState,
): AuthenticatedSessionScope | null =>
  state.status === "authenticated"
    ? { subject: state.subject, epoch: state.epoch }
    : null;
