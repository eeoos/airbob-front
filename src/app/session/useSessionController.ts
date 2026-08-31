import type { QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  isSessionAuthenticationError,
  normalizeSessionAuthError,
  sessionAuthPort,
  type SessionAuthPort,
  type SessionCredentials,
} from "../../features/auth/ports/sessionPort";
import { AppError } from "../../platform/http/errors";
import { isSameAuthenticatedSessionScope } from "../../platform/session/sessionScope";
import {
  createSessionBroadcast,
  type SessionBroadcast,
  type SessionBroadcastPhase,
} from "../../platform/session/sessionBroadcast";
import type { SessionContextValue } from "./sessionContext";
import {
  createSessionCommandQueue,
  type SessionCommandQueue,
} from "./sessionCommandQueue";
import { sessionReducer, type SessionAction } from "./sessionReducer";
import {
  createInitialSessionState,
  toAuthenticatedSessionScope,
  toSessionSubject,
  type AuthenticatedSessionScope,
  type SessionState,
  type SessionSubject,
  type SessionViewer,
} from "./sessionState";
import { useSessionExternalSync } from "./useSessionExternalSync";
import {
  useSessionQueryLifetime,
  type SessionQueryClientFactory,
} from "./useSessionQueryLifetime";

export interface SessionControllerOptions {
  readonly authPort?: SessionAuthPort;
  readonly broadcastFactory?: () => SessionBroadcast;
  readonly clearIdentityOwnedState?: () => void;
  readonly initialQueryClient?: QueryClient;
  readonly initialState?: SessionState;
  readonly queryClientFactory?: SessionQueryClientFactory;
}

export interface SessionControllerResult {
  readonly session: SessionContextValue;
  readonly queryGeneration: {
    readonly client: QueryClient;
    readonly fenceId: number;
  };
}

interface ActiveOperation {
  readonly controller: AbortController;
  readonly id: number;
}

interface PendingExternalBoundary {
  readonly operation: ActiveOperation;
  readonly cleanup: Promise<boolean>;
}

const NOOP_IDENTITY_CLEANUP = () => undefined;

const createStaleSessionOperationError = () =>
  new AppError({
    kind: "cancelled",
    code: "STALE_SESSION_OPERATION",
    message: "The session operation was superseded.",
  });

const initialOperationId = (state: SessionState) =>
  state.status === "authenticated" ? 0 : state.operationId;

export function useSessionController({
  authPort = sessionAuthPort,
  broadcastFactory = createSessionBroadcast,
  clearIdentityOwnedState = NOOP_IDENTITY_CLEANUP,
  initialQueryClient,
  initialState,
  queryClientFactory,
}: SessionControllerOptions = {}): SessionControllerResult {
  const resolvedInitialState = useMemo(
    () => initialState ?? createInitialSessionState({ operationId: 0 }),
    [initialState],
  );
  const [state, rawDispatch] = useReducer(sessionReducer, resolvedInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const operationSequenceRef = useRef(initialOperationId(resolvedInitialState));
  const activeOperationRef = useRef<ActiveOperation | null>(null);
  const mountedRef = useRef(false);
  const mountGenerationRef = useRef(0);
  const bootstrapStartedRef = useRef(initialState !== undefined);
  const activeCookieTransportCountRef = useRef(0);
  const cookieCommandOperationsRef = useRef(new Set<ActiveOperation>());
  const deferredRemotePhaseRef = useRef<SessionBroadcastPhase | null>(null);
  const replayRemotePhaseRef = useRef<(phase: SessionBroadcastPhase) => void>(
    () => undefined,
  );
  const commandQueueRef = useRef<SessionCommandQueue | null>(null);
  if (commandQueueRef.current === null) {
    commandQueueRef.current = createSessionCommandQueue();
  }
  const cancelExternalRecoveryRef = useRef<() => void>(() => undefined);
  const publishSessionPhaseRef = useRef<(phase: SessionBroadcastPhase) => void>(
    () => undefined,
  );
  const logoutPromiseRef = useRef<Promise<void> | null>(null);
  const pendingExternalBoundaryRef = useRef<PendingExternalBoundary | null>(
    null,
  );
  const externalProbeOperationRef = useRef<ActiveOperation | null>(null);
  const externalVerificationRef = useRef<Promise<void> | null>(null);
  const {
    disposeCurrentGeneration,
    generation: queryGeneration,
    getCurrentGeneration,
    replaceQueryGeneration: replaceQueryLifetime,
    resetQueryGeneration: resetQueryLifetime,
    stabilizeQueryGeneration: stabilizeQueryLifetime,
  } = useSessionQueryLifetime({
    initialState: resolvedInitialState,
    ...(initialQueryClient === undefined ? {} : { initialQueryClient }),
    ...(queryClientFactory === undefined ? {} : { queryClientFactory }),
  });

  const dispatch = useCallback((action: SessionAction) => {
    stateRef.current = sessionReducer(stateRef.current, action);
    rawDispatch(action);
  }, []);

  const hasActiveCookieCommand = useCallback(
    () =>
      activeCookieTransportCountRef.current > 0 ||
      cookieCommandOperationsRef.current.size > 0,
    [],
  );

  const replayDeferredRemotePhaseIfIdle = useCallback(() => {
    if (hasActiveCookieCommand() || externalVerificationRef.current !== null) {
      return;
    }

    const phase = deferredRemotePhaseRef.current;
    if (phase === null) return;

    deferredRemotePhaseRef.current = null;
    if (!mountedRef.current) return;
    replayRemotePhaseRef.current(phase);
  }, [hasActiveCookieCommand]);

  const isCurrentOperation = useCallback(
    (operation: ActiveOperation) =>
      mountedRef.current &&
      activeOperationRef.current === operation &&
      !operation.controller.signal.aborted,
    [],
  );

  const beginOperation = useCallback((): ActiveOperation => {
    activeOperationRef.current?.controller.abort();
    pendingExternalBoundaryRef.current = null;
    externalVerificationRef.current = null;
    cancelExternalRecoveryRef.current();

    const operation: ActiveOperation = {
      controller: new AbortController(),
      id: ++operationSequenceRef.current,
    };
    activeOperationRef.current = operation;
    return operation;
  }, []);

  const finishOperation = useCallback((operation: ActiveOperation) => {
    if (activeOperationRef.current === operation) {
      activeOperationRef.current = null;
    }
  }, []);

  const beginCookieOperation = useCallback(() => {
    const operation = beginOperation();
    cookieCommandOperationsRef.current.add(operation);
    return operation;
  }, [beginOperation]);

  const finishCookieOperation = useCallback(
    (operation: ActiveOperation) => {
      finishOperation(operation);
      cookieCommandOperationsRef.current.delete(operation);
      replayDeferredRemotePhaseIfIdle();
    },
    [finishOperation, replayDeferredRemotePhaseIfIdle],
  );

  const replaceQueryGeneration = useCallback(
    async (
      epoch: number,
      subject: SessionSubject | null,
      operation: ActiveOperation,
      tainted = false,
    ) => {
      return replaceQueryLifetime({
        epoch,
        subject,
        tainted,
        isStillCurrent: () => isCurrentOperation(operation),
      });
    },
    [isCurrentOperation, replaceQueryLifetime],
  );

  const resetQueryGeneration = useCallback(
    (epoch: number, operation: ActiveOperation) =>
      resetQueryLifetime({
        epoch,
        subject: null,
        isStillCurrent: () => isCurrentOperation(operation),
      }),
    [isCurrentOperation, resetQueryLifetime],
  );

  const stabilizeQueryGeneration = useCallback(
    (epoch: number, operation: ActiveOperation) =>
      stabilizeQueryLifetime({
        epoch,
        subject: null,
        isStillCurrent: () => isCurrentOperation(operation),
      }),
    [isCurrentOperation, stabilizeQueryLifetime],
  );

  const runViewerProbe = useCallback(
    (operation: ActiveOperation): Promise<SessionViewer> =>
      authPort.getViewer(operation.controller.signal),
    [authPort],
  );

  const runCookieTransport = useCallback(
    async <T>(transport: () => Promise<T>): Promise<T> => {
      activeCookieTransportCountRef.current += 1;
      try {
        return await transport();
      } finally {
        activeCookieTransportCountRef.current -= 1;
        replayDeferredRemotePhaseIfIdle();
      }
    },
    [replayDeferredRemotePhaseIfIdle],
  );

  const advanceCheckingBoundary = useCallback(
    async (
      operation: ActiveOperation,
      reason: "external-change" | "identity-change",
    ) => {
      const canResetInPlace = stateRef.current.status !== "authenticated";
      const capturedEpoch = stateRef.current.epoch;
      dispatch({
        type: "session/check-started",
        reason,
        operationId: operation.id,
        epoch: capturedEpoch,
      });
      const nextEpoch = stateRef.current.epoch;
      try {
        clearIdentityOwnedState();
      } catch (error) {
        dispatch({
          type: "session/check-failed",
          operationId: operation.id,
          epoch: nextEpoch,
          error: normalizeSessionAuthError(error),
        });
        throw error;
      }
      if (canResetInPlace) {
        return resetQueryGeneration(nextEpoch, operation);
      }
      return replaceQueryGeneration(nextEpoch, null, operation, true);
    },
    [
      clearIdentityOwnedState,
      dispatch,
      replaceQueryGeneration,
      resetQueryGeneration,
    ],
  );

  const publishCheckedViewer = useCallback(
    async (
      operation: ActiveOperation,
      viewer: SessionViewer,
      actionType: "session/check-succeeded" | "session/identity-published",
    ) => {
      if (!isCurrentOperation(operation)) return false;

      const epoch = stateRef.current.epoch;
      const subject = toSessionSubject(viewer);
      const currentGeneration = getCurrentGeneration();
      if (
        currentGeneration.epoch !== epoch ||
        currentGeneration.subject !== subject ||
        currentGeneration.tainted
      ) {
        const didReplace = await replaceQueryGeneration(
          epoch,
          subject,
          operation,
        );
        if (!didReplace) return false;
      }

      dispatch({
        type: actionType,
        operationId: operation.id,
        epoch,
        viewer,
      });
      return stateRef.current.status === "authenticated";
    },
    [
      dispatch,
      getCurrentGeneration,
      isCurrentOperation,
      replaceQueryGeneration,
    ],
  );

  const settleCheckingProbe = useCallback(
    async (
      operation: ActiveOperation,
      successType: "session/check-succeeded" | "session/identity-published",
    ): Promise<boolean> => {
      try {
        const viewer = await runViewerProbe(operation);
        if (!isCurrentOperation(operation)) return false;
        return publishCheckedViewer(operation, viewer, successType);
      } catch (error) {
        if (!isCurrentOperation(operation)) return false;

        const epoch = stateRef.current.epoch;
        if (getCurrentGeneration().tainted) {
          if (!stabilizeQueryGeneration(epoch, operation)) return false;
        }

        if (isSessionAuthenticationError(error)) {
          try {
            clearIdentityOwnedState();
          } catch (cleanupError) {
            dispatch({
              type: "session/check-failed",
              operationId: operation.id,
              epoch,
              error: normalizeSessionAuthError(cleanupError),
            });
            throw cleanupError;
          }
          dispatch({
            type: "session/check-anonymous",
            operationId: operation.id,
            epoch,
          });
        } else {
          dispatch({
            type: "session/check-failed",
            operationId: operation.id,
            epoch,
            error: normalizeSessionAuthError(error),
          });
        }
        throw error;
      }
    },
    [
      clearIdentityOwnedState,
      dispatch,
      getCurrentGeneration,
      isCurrentOperation,
      publishCheckedViewer,
      runViewerProbe,
      stabilizeQueryGeneration,
    ],
  );

  const runBootstrap = useCallback(async () => {
    const operation = beginOperation();
    dispatch({
      type: "session/check-started",
      reason: "bootstrap",
      operationId: operation.id,
      epoch: stateRef.current.epoch,
    });

    try {
      await settleCheckingProbe(operation, "session/check-succeeded");
    } catch {
      // The reducer exposes anonymous/error bootstrap outcomes to the UI.
    } finally {
      finishOperation(operation);
    }
  }, [beginOperation, dispatch, finishOperation, settleCheckingProbe]);

  const verifyExternalBoundary = useCallback(
    async (pending: PendingExternalBoundary) => {
      const { operation } = pending;
      try {
        const didClean = await pending.cleanup;
        if (!didClean || !isCurrentOperation(operation)) return;

        externalProbeOperationRef.current = operation;
        try {
          await settleCheckingProbe(operation, "session/check-succeeded");
        } finally {
          if (externalProbeOperationRef.current === operation) {
            externalProbeOperationRef.current = null;
          }
        }
      } catch (error) {
        if (
          isCurrentOperation(operation) &&
          stateRef.current.status === "checking"
        ) {
          if (getCurrentGeneration().tainted) {
            if (!stabilizeQueryGeneration(stateRef.current.epoch, operation))
              return;
          }

          dispatch({
            type: "session/check-failed",
            operationId: operation.id,
            epoch: stateRef.current.epoch,
            error: normalizeSessionAuthError(error),
          });
        }
      } finally {
        if (pendingExternalBoundaryRef.current === pending) {
          pendingExternalBoundaryRef.current = null;
        }
        finishOperation(operation);
      }
    },
    [
      dispatch,
      finishOperation,
      getCurrentGeneration,
      isCurrentOperation,
      settleCheckingProbe,
      stabilizeQueryGeneration,
    ],
  );

  const scheduleExternalVerification = useCallback(
    (pending: PendingExternalBoundary) => {
      cancelExternalRecoveryRef.current();

      const existing = externalVerificationRef.current;
      if (existing) return existing;

      const verification = verifyExternalBoundary(pending).finally(() => {
        if (externalVerificationRef.current === verification) {
          externalVerificationRef.current = null;
          replayDeferredRemotePhaseIfIdle();
        }
      });
      externalVerificationRef.current = verification;
      return verification;
    },
    [replayDeferredRemotePhaseIfIdle, verifyExternalBoundary],
  );

  const invalidateForExternalChange = useCallback(() => {
    const existing = pendingExternalBoundaryRef.current;
    if (existing) return existing;

    const operation = beginOperation();
    const pending: PendingExternalBoundary = {
      operation,
      cleanup: advanceCheckingBoundary(operation, "external-change"),
    };
    pendingExternalBoundaryRef.current = pending;
    return pending;
  }, [advanceCheckingBoundary, beginOperation]);

  const revalidate = useCallback(async () => {
    const current = stateRef.current;
    const pendingExternal = pendingExternalBoundaryRef.current;
    if (pendingExternal) {
      await scheduleExternalVerification(pendingExternal);
      return;
    }

    if (current.status !== "authenticated") {
      await runBootstrap();
      return;
    }

    const operation = beginOperation();
    dispatch({
      type: "session/revalidation-started",
      operationId: operation.id,
      epoch: current.epoch,
    });

    try {
      const viewer = await runViewerProbe(operation);
      if (!isCurrentOperation(operation)) return;

      const latest = stateRef.current;
      if (latest.status !== "authenticated") return;

      const candidateSubject = toSessionSubject(viewer);
      if (candidateSubject === latest.subject) {
        dispatch({
          type: "session/revalidation-succeeded",
          operationId: operation.id,
          epoch: latest.epoch,
          viewer,
        });
        return;
      }

      dispatch({
        type: "session/revalidation-succeeded",
        operationId: operation.id,
        epoch: latest.epoch,
        viewer,
      });
      try {
        clearIdentityOwnedState();
      } catch (cleanupError) {
        dispatch({
          type: "session/check-failed",
          operationId: operation.id,
          epoch: stateRef.current.epoch,
          error: normalizeSessionAuthError(cleanupError),
        });
        throw cleanupError;
      }
      const didReplace = await replaceQueryGeneration(
        stateRef.current.epoch,
        null,
        operation,
        true,
      );
      if (!didReplace) return;
      await publishCheckedViewer(
        operation,
        viewer,
        "session/identity-published",
      );
    } catch (error) {
      if (!isCurrentOperation(operation)) return;

      const latest = stateRef.current;
      if (isSessionAuthenticationError(error)) {
        const capturedEpoch = latest.epoch;
        let cleanupError: unknown;
        try {
          clearIdentityOwnedState();
        } catch (caughtCleanupError) {
          cleanupError = caughtCleanupError;
        }
        dispatch({
          type: "session/auth-revoked",
          operationId: operation.id,
          epoch: capturedEpoch,
        });
        await replaceQueryGeneration(stateRef.current.epoch, null, operation);
        publishSessionPhaseRef.current("revalidate");
        if (cleanupError !== undefined) throw cleanupError;
      } else if (latest.status === "authenticated") {
        dispatch({
          type: "session/revalidation-failed",
          operationId: operation.id,
          epoch: latest.epoch,
          error: normalizeSessionAuthError(error),
        });
      }
      throw error;
    } finally {
      finishOperation(operation);
    }
  }, [
    beginOperation,
    clearIdentityOwnedState,
    dispatch,
    finishOperation,
    isCurrentOperation,
    publishCheckedViewer,
    replaceQueryGeneration,
    runBootstrap,
    runViewerProbe,
    scheduleExternalVerification,
  ]);

  const login = useCallback(
    async (credentials: SessionCredentials) => {
      const operation = beginCookieOperation();

      publishSessionPhaseRef.current("invalidate");

      try {
        const didClean = await advanceCheckingBoundary(
          operation,
          "identity-change",
        );
        if (!didClean) throw createStaleSessionOperationError();

        try {
          await commandQueueRef.current!.run(operation.controller.signal, () =>
            runCookieTransport(() => authPort.login(credentials)),
          );
        } catch (error) {
          if (!isCurrentOperation(operation)) {
            throw createStaleSessionOperationError();
          }

          try {
            await settleCheckingProbe(operation, "session/identity-published");
          } catch {
            // The session probe owns the visible terminal state; the login
            // error remains the caller-facing command result.
          }
          throw error;
        }

        if (!isCurrentOperation(operation)) {
          throw createStaleSessionOperationError();
        }

        const didPublish = await settleCheckingProbe(
          operation,
          "session/identity-published",
        );
        if (!didPublish) throw createStaleSessionOperationError();
      } finally {
        if (isCurrentOperation(operation)) {
          publishSessionPhaseRef.current("revalidate");
        }
        finishCookieOperation(operation);
      }
    },
    [
      advanceCheckingBoundary,
      authPort,
      beginCookieOperation,
      finishCookieOperation,
      isCurrentOperation,
      runCookieTransport,
      settleCheckingProbe,
    ],
  );

  const settleServerLogout = useCallback(
    async (
      operation: ActiveOperation,
      operationId: number,
      epoch: number,
      cleanupError?: unknown,
    ): Promise<boolean> => {
      let transportError: unknown;
      try {
        await commandQueueRef.current!.run(operation.controller.signal, () =>
          runCookieTransport(() => authPort.logout()),
        );
      } catch (error) {
        transportError = error;
      }
      if (!isCurrentOperation(operation)) return false;

      const didReplace = await replaceQueryGeneration(epoch, null, operation);
      if (!didReplace) return false;

      const serverRevocationVerified =
        transportError === undefined ||
        isSessionAuthenticationError(transportError);
      if (serverRevocationVerified && cleanupError === undefined) {
        dispatch({
          type: "session/logout-settled",
          operationId,
          epoch,
          revocation: "verified",
        });
        return true;
      }

      const blockingError =
        transportError !== undefined &&
        !isSessionAuthenticationError(transportError)
          ? transportError
          : cleanupError;
      dispatch({
        type: "session/logout-settled",
        operationId,
        epoch,
        revocation: "unverified",
        error: normalizeSessionAuthError(blockingError),
      });
      throw blockingError;
    },
    [
      authPort,
      dispatch,
      isCurrentOperation,
      replaceQueryGeneration,
      runCookieTransport,
    ],
  );

  const executeLogout = useCallback(async () => {
    const operation = beginCookieOperation();
    const shouldFenceExistingIdentity =
      stateRef.current.status === "authenticated";
    const capturedEpoch = stateRef.current.epoch;
    publishSessionPhaseRef.current("invalidate");
    dispatch({
      type: "session/logout-started",
      operationId: operation.id,
      epoch: capturedEpoch,
    });
    const logoutState = stateRef.current;

    let cleanupError: unknown;
    try {
      clearIdentityOwnedState();
    } catch (caughtCleanupError) {
      cleanupError = caughtCleanupError;
    }

    try {
      const didReplace = await replaceQueryGeneration(
        logoutState.epoch,
        null,
        operation,
        shouldFenceExistingIdentity,
      );
      if (!didReplace) throw createStaleSessionOperationError();
      const didSettle = await settleServerLogout(
        operation,
        operation.id,
        logoutState.epoch,
        cleanupError,
      );
      if (!didSettle) throw createStaleSessionOperationError();
    } finally {
      if (isCurrentOperation(operation)) {
        publishSessionPhaseRef.current("revalidate");
      }
      finishCookieOperation(operation);
    }
  }, [
    beginCookieOperation,
    clearIdentityOwnedState,
    dispatch,
    finishCookieOperation,
    isCurrentOperation,
    replaceQueryGeneration,
    settleServerLogout,
  ]);

  const logout = useCallback(() => {
    const pendingLogout = logoutPromiseRef.current;
    if (pendingLogout) return pendingLogout;

    const logoutOperation = executeLogout().finally(() => {
      if (logoutPromiseRef.current === logoutOperation) {
        logoutPromiseRef.current = null;
      }
    });
    logoutPromiseRef.current = logoutOperation;
    return logoutOperation;
  }, [executeLogout]);

  const retryServerLogout = useCallback(async () => {
    const current = stateRef.current;
    if (
      current.status !== "anonymous" ||
      current.reason !== "logout" ||
      current.revocation !== "unverified"
    ) {
      return;
    }

    const operation = beginCookieOperation();
    try {
      let cleanupError: unknown;
      try {
        clearIdentityOwnedState();
      } catch (caughtCleanupError) {
        cleanupError = caughtCleanupError;
      }
      const didSettle = await settleServerLogout(
        operation,
        current.operationId,
        current.epoch,
        cleanupError,
      );
      if (!didSettle) throw createStaleSessionOperationError();
    } finally {
      if (isCurrentOperation(operation)) {
        publishSessionPhaseRef.current("revalidate");
      }
      finishCookieOperation(operation);
    }
  }, [
    beginCookieOperation,
    clearIdentityOwnedState,
    finishCookieOperation,
    isCurrentOperation,
    settleServerLogout,
  ]);

  const captureAuthenticatedSession = useCallback(
    () => toAuthenticatedSessionScope(stateRef.current),
    [],
  );

  const isCurrentSession = useCallback((scope: AuthenticatedSessionScope) => {
    const current = toAuthenticatedSessionScope(stateRef.current);
    return current !== null && isSameAuthenticatedSessionScope(current, scope);
  }, []);

  const deferRemotePhase = useCallback(
    (phase: SessionBroadcastPhase) => {
      deferredRemotePhaseRef.current = phase;

      if (hasActiveCookieCommand()) return;
      externalProbeOperationRef.current?.controller.abort();
    },
    [hasActiveCookieCommand],
  );

  const shouldDeferInboundRemotePhase = useCallback(
    () =>
      hasActiveCookieCommand() || externalProbeOperationRef.current !== null,
    [hasActiveCookieCommand],
  );

  const handleExternalAuthError = useCallback(() => {
    if (hasActiveCookieCommand()) return;
    if (externalProbeOperationRef.current !== null) {
      deferRemotePhase("revalidate");
      return;
    }
    if (externalVerificationRef.current) return;

    publishSessionPhaseRef.current("invalidate");
    const pending = invalidateForExternalChange();
    void scheduleExternalVerification(pending).finally(() => {
      publishSessionPhaseRef.current("revalidate");
    });
  }, [
    deferRemotePhase,
    hasActiveCookieCommand,
    invalidateForExternalChange,
    scheduleExternalVerification,
  ]);

  const handleFocus = useCallback(() => {
    const pending = pendingExternalBoundaryRef.current;
    if (pending) {
      void scheduleExternalVerification(pending);
      return;
    }

    if (activeOperationRef.current !== null) return;

    if (stateRef.current.status === "authenticated") {
      void revalidate().catch(() => undefined);
      return;
    }

    if (
      (stateRef.current.status === "anonymous" &&
        !(
          stateRef.current.reason === "logout" &&
          stateRef.current.revocation === "unverified"
        )) ||
      stateRef.current.status === "error"
    ) {
      void runBootstrap();
    }
  }, [revalidate, runBootstrap, scheduleExternalVerification]);

  const isExternalBoundaryCurrent = useCallback(
    (pending: PendingExternalBoundary) =>
      mountedRef.current && pendingExternalBoundaryRef.current === pending,
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    mountGenerationRef.current += 1;
    const currentMountGeneration = mountGenerationRef.current;

    if (!bootstrapStartedRef.current) {
      bootstrapStartedRef.current = true;
      void runBootstrap();
    }

    return () => {
      mountedRef.current = false;

      void Promise.resolve().then(() => {
        if (
          mountedRef.current ||
          mountGenerationRef.current !== currentMountGeneration
        ) {
          return;
        }

        activeOperationRef.current?.controller.abort();
        pendingExternalBoundaryRef.current = null;
        externalProbeOperationRef.current = null;
        deferredRemotePhaseRef.current = null;
        void disposeCurrentGeneration();
      });
    };
  }, [disposeCurrentGeneration, runBootstrap]);

  const { cancelRecovery, publish, replayRemotePhase } = useSessionExternalSync(
    {
      broadcastFactory,
      isBoundaryCurrent: isExternalBoundaryCurrent,
      onAuthError: handleExternalAuthError,
      onDeferredRemotePhase: deferRemotePhase,
      onFocus: handleFocus,
      onRemoteInvalidate: invalidateForExternalChange,
      onRemoteVerify: scheduleExternalVerification,
      shouldDeferRemotePhase: shouldDeferInboundRemotePhase,
    },
  );
  cancelExternalRecoveryRef.current = cancelRecovery;
  publishSessionPhaseRef.current = publish;
  replayRemotePhaseRef.current = replayRemotePhase;

  const session = useMemo<SessionContextValue>(
    () => ({
      state,
      login,
      logout,
      revalidate,
      retryServerLogout,
      captureAuthenticatedSession,
      isCurrentSession,
    }),
    [
      captureAuthenticatedSession,
      isCurrentSession,
      login,
      logout,
      revalidate,
      retryServerLogout,
      state,
    ],
  );

  return { queryGeneration, session };
}
