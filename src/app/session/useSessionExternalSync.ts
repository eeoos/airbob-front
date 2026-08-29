import { useCallback, useEffect, useRef } from "react";
import { onAuthError } from "../../platform/session/authEvents";
import type {
  SessionBroadcast,
  SessionBroadcastPhase,
} from "../../platform/session/sessionBroadcast";

interface UseSessionExternalSyncOptions<Boundary> {
  readonly broadcastFactory: () => SessionBroadcast;
  readonly isBoundaryCurrent: (boundary: Boundary) => boolean;
  readonly onAuthError: () => void;
  readonly onDeferredRemotePhase: (phase: SessionBroadcastPhase) => void;
  readonly onFocus: () => void;
  readonly onRemoteInvalidate: () => Boundary;
  readonly onRemoteVerify: (boundary: Boundary) => Promise<void>;
  readonly recoveryMs?: number;
  readonly shouldDeferRemotePhase: () => boolean;
}

const DEFAULT_RECOVERY_MS = 1_500;

export const useSessionExternalSync = <Boundary,>({
  broadcastFactory,
  isBoundaryCurrent,
  onAuthError: handleAuthError,
  onDeferredRemotePhase,
  onFocus,
  onRemoteInvalidate,
  onRemoteVerify,
  recoveryMs = DEFAULT_RECOVERY_MS,
  shouldDeferRemotePhase,
}: UseSessionExternalSyncOptions<Boundary>) => {
  const broadcastRef = useRef<SessionBroadcast | null>(null);
  const recoveryTimerRef = useRef<number | null>(null);

  const cancelRecovery = useCallback(() => {
    if (recoveryTimerRef.current === null) return;

    window.clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = null;
  }, []);

  const verifyBoundary = useCallback(
    (boundary: Boundary) => {
      cancelRecovery();
      return onRemoteVerify(boundary);
    },
    [cancelRecovery, onRemoteVerify],
  );

  const scheduleRecovery = useCallback(
    (boundary: Boundary) => {
      if (recoveryTimerRef.current !== null) return;

      recoveryTimerRef.current = window.setTimeout(() => {
        recoveryTimerRef.current = null;
        if (!isBoundaryCurrent(boundary)) return;

        void onRemoteVerify(boundary);
      }, recoveryMs);
    },
    [isBoundaryCurrent, onRemoteVerify, recoveryMs],
  );

  const publish = useCallback((phase: SessionBroadcastPhase) => {
    broadcastRef.current?.publish(phase);
  }, []);

  const replayRemotePhase = useCallback(
    (phase: SessionBroadcastPhase) => {
      const boundary = onRemoteInvalidate();
      if (phase === "invalidate") {
        scheduleRecovery(boundary);
        return;
      }

      void verifyBoundary(boundary);
    },
    [onRemoteInvalidate, scheduleRecovery, verifyBoundary],
  );

  useEffect(() => {
    const broadcast = broadcastFactory();
    broadcastRef.current = broadcast;

    const unsubscribeBroadcast = broadcast.subscribe((message) => {
      if (shouldDeferRemotePhase()) {
        onDeferredRemotePhase(message.phase);
        return;
      }

      replayRemotePhase(message.phase);
    });
    const unsubscribeAuthError = onAuthError(handleAuthError);
    window.addEventListener("focus", onFocus);

    return () => {
      unsubscribeBroadcast();
      unsubscribeAuthError();
      window.removeEventListener("focus", onFocus);
      cancelRecovery();
      if (broadcastRef.current === broadcast) broadcastRef.current = null;
      broadcast.close();
    };
  }, [
    broadcastFactory,
    cancelRecovery,
    handleAuthError,
    onDeferredRemotePhase,
    onFocus,
    replayRemotePhase,
    shouldDeferRemotePhase,
  ]);

  return { cancelRecovery, publish, replayRemotePhase };
};
