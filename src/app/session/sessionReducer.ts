import type { AppError } from "../../platform/http/errors";
import {
  toSessionSubject,
  type SessionAuthenticatedState,
  type SessionAnonymousState,
  type SessionCheckingReason,
  type SessionCheckingState,
  type SessionRevocation,
  type SessionState,
  type SessionViewer,
} from "./sessionState";

interface SessionOperationAction {
  readonly operationId: number;
  readonly epoch: number;
}

export type SessionAction =
  | (SessionOperationAction & {
      readonly type: "session/check-started";
      readonly reason: SessionCheckingReason;
    })
  | (SessionOperationAction & {
      readonly type: "session/check-succeeded";
      readonly viewer: SessionViewer;
    })
  | (SessionOperationAction & {
      readonly type: "session/check-anonymous";
    })
  | (SessionOperationAction & {
      readonly type: "session/check-failed";
      readonly error: AppError;
    })
  | (SessionOperationAction & {
      readonly type: "session/revalidation-started";
    })
  | (SessionOperationAction & {
      readonly type: "session/revalidation-succeeded";
      readonly viewer: SessionViewer;
    })
  | (SessionOperationAction & {
      readonly type: "session/revalidation-failed";
      readonly error: AppError;
    })
  | (SessionOperationAction & {
      readonly type: "session/identity-published";
      readonly viewer: SessionViewer;
    })
  | (SessionOperationAction & {
      readonly type: "session/logout-started";
    })
  | (SessionOperationAction & {
      readonly type: "session/logout-settled";
      readonly revocation: SessionRevocation;
      readonly error?: AppError;
    })
  | (SessionOperationAction & {
      readonly type: "session/auth-revoked";
    });

const advanceEpoch = (epoch: number) => epoch + 1;

const isCurrentCheckingOperation = (
  state: SessionState,
  action: SessionOperationAction,
): state is SessionCheckingState =>
  state.status === "checking" &&
  state.operationId === action.operationId &&
  state.epoch === action.epoch;

const isCurrentRevalidation = (
  state: SessionState,
  action: SessionOperationAction,
): state is SessionAuthenticatedState & {
  readonly revalidation: {
    readonly status: "checking";
    readonly operationId: number;
  };
} =>
  state.status === "authenticated" &&
  state.epoch === action.epoch &&
  state.revalidation.status === "checking" &&
  state.revalidation.operationId === action.operationId;

const toAuthenticatedState = (
  viewer: SessionViewer,
  epoch: number,
): SessionAuthenticatedState => ({
  status: "authenticated",
  viewer,
  subject: toSessionSubject(viewer),
  epoch,
  revalidation: { status: "idle" },
});

const verifyAnonymousRevocation = (
  state: SessionAnonymousState,
): SessionAnonymousState => {
  if (state.revocation === "verified" && state.revocationError === undefined) {
    return state;
  }

  const { revocationError: _revocationError, ...anonymousState } = state;
  return { ...anonymousState, revocation: "verified" };
};

const assertNever = (action: never): never => {
  throw new Error(`Unhandled session action: ${String(action)}`);
};

export const sessionReducer = (
  state: SessionState,
  action: SessionAction,
): SessionState => {
  switch (action.type) {
    case "session/check-started": {
      if (state.epoch !== action.epoch) return state;

      const advancesEpoch = action.reason !== "bootstrap";

      return {
        status: "checking",
        reason: action.reason,
        operationId: action.operationId,
        epoch: advancesEpoch ? advanceEpoch(state.epoch) : state.epoch,
      };
    }

    case "session/check-succeeded":
      if (
        !isCurrentCheckingOperation(state, action) ||
        state.reason === "identity-change"
      ) {
        return state;
      }

      return toAuthenticatedState(action.viewer, state.epoch);

    case "session/check-anonymous":
      if (!isCurrentCheckingOperation(state, action)) return state;

      return {
        status: "anonymous",
        reason: state.reason === "bootstrap" ? "bootstrap" : "server-revoked",
        revocation: "verified",
        operationId: action.operationId,
        epoch: action.epoch,
      };

    case "session/check-failed":
      if (!isCurrentCheckingOperation(state, action)) return state;

      return {
        status: "error",
        reason: state.reason,
        operationId: action.operationId,
        epoch: action.epoch,
        error: action.error,
        retryable: true,
      };

    case "session/revalidation-started":
      if (state.status !== "authenticated" || state.epoch !== action.epoch) {
        return state;
      }

      return {
        ...state,
        revalidation: {
          status: "checking",
          operationId: action.operationId,
        },
      };

    case "session/revalidation-succeeded": {
      if (!isCurrentRevalidation(state, action)) return state;

      const candidateSubject = toSessionSubject(action.viewer);

      if (candidateSubject === state.subject) {
        return toAuthenticatedState(action.viewer, state.epoch);
      }

      return {
        status: "checking",
        reason: "identity-change",
        operationId: action.operationId,
        epoch: advanceEpoch(state.epoch),
      };
    }

    case "session/revalidation-failed":
      if (!isCurrentRevalidation(state, action)) return state;

      return {
        ...state,
        revalidation: {
          status: "error",
          operationId: action.operationId,
          error: action.error,
        },
      };

    case "session/identity-published":
      if (
        !isCurrentCheckingOperation(state, action) ||
        state.reason !== "identity-change"
      ) {
        return state;
      }

      return toAuthenticatedState(action.viewer, state.epoch);

    case "session/logout-started":
      if (state.epoch !== action.epoch) {
        return state;
      }

      return {
        status: "anonymous",
        reason: "logout",
        revocation: "unverified",
        operationId: action.operationId,
        epoch: advanceEpoch(state.epoch),
      };

    case "session/logout-settled":
      if (
        state.status !== "anonymous" ||
        state.reason !== "logout" ||
        state.operationId !== action.operationId ||
        state.epoch !== action.epoch
      ) {
        return state;
      }

      if (action.revocation === "verified") {
        return verifyAnonymousRevocation(state);
      }

      if (state.revocation === "verified" || action.error === undefined) {
        return state;
      }

      return state.revocationError === action.error
        ? state
        : { ...state, revocationError: action.error };

    case "session/auth-revoked":
      if (state.epoch !== action.epoch) return state;

      if (state.status === "anonymous") {
        return verifyAnonymousRevocation(state);
      }

      return {
        status: "anonymous",
        reason:
          (state.status === "checking" || state.status === "error") &&
          state.reason === "bootstrap"
            ? "bootstrap"
            : "server-revoked",
        revocation: "verified",
        operationId: action.operationId,
        epoch: advanceEpoch(state.epoch),
      };

    default:
      return assertNever(action);
  }
};
