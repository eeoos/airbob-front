import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPath, useLocation, type Location } from "react-router-dom";
import {
  isSameAuthenticatedSessionScope,
  type AuthenticatedSessionScope,
} from "../../platform/session/sessionScope";
import {
  snapshotAuthIntent,
  type AuthIntent,
  type AuthIntentAttemptId,
} from "./authIntent";
import {
  AuthIntentContext,
  type AuthIntentContextValue,
  type AuthIntentSource,
  type ClaimAuthIntent,
  type ClaimedAuthIntent,
  type PendingAuthIntent,
} from "./authIntentContext";

export interface AuthIntentSessionSnapshot {
  readonly status: "checking" | "authenticated" | "anonymous" | "error";
  readonly reason?:
    | "bootstrap"
    | "external-change"
    | "identity-change"
    | "logout"
    | "server-revoked";
}

export interface AuthIntentSessionPort {
  readonly state: AuthIntentSessionSnapshot;
  captureAuthenticatedSession(): AuthenticatedSessionScope | null;
  isCurrentSession(scope: AuthenticatedSessionScope): boolean;
}

export interface AuthIntentProviderProps {
  readonly children: ReactNode;
  readonly session: AuthIntentSessionPort;
}

interface PendingAuthIntentRecord {
  readonly value: PendingAuthIntent;
  readonly boundSession: AuthenticatedSessionScope | null;
  readonly anonymousLoginAttemptObserved: boolean;
}

const toLocationSource = (location: Location): AuthIntentSource =>
  Object.freeze({
    locationKey: location.key,
    path: createPath(location),
  });

const isSameSource = (left: AuthIntentSource, right: AuthIntentSource) =>
  left.locationKey === right.locationKey && left.path === right.path;

export function AuthIntentProvider({
  children,
  session,
}: AuthIntentProviderProps) {
  const location = useLocation();
  const currentSource = useMemo(() => toLocationSource(location), [location]);
  const currentSourceRef = useRef(currentSource);
  currentSourceRef.current = currentSource;

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const previousSessionStateRef = useRef(session.state);
  const nextAttemptIdRef = useRef(0);
  const pendingRecordRef = useRef<PendingAuthIntentRecord | null>(null);
  const [pending, setPending] = useState<PendingAuthIntent | null>(null);

  const replacePending = useCallback(
    (record: PendingAuthIntentRecord | null) => {
      pendingRecordRef.current = record;
      setPending(record?.value ?? null);
    },
    [],
  );

  const request = useCallback(
    (intent: AuthIntent): AuthIntentAttemptId => {
      const nextAttemptId = nextAttemptIdRef.current + 1;
      if (!Number.isSafeInteger(nextAttemptId)) {
        throw new RangeError("Auth intent attempt id space is exhausted.");
      }

      const attemptId = nextAttemptId as AuthIntentAttemptId;
      nextAttemptIdRef.current = attemptId;

      const activeSession = sessionRef.current.captureAuthenticatedSession();
      const value = Object.freeze({
        attemptId,
        intent: snapshotAuthIntent(intent),
        source: currentSourceRef.current,
      });

      replacePending({
        value,
        boundSession: activeSession,
        anonymousLoginAttemptObserved:
          !activeSession &&
          (sessionRef.current.state.status === "checking" ||
            sessionRef.current.state.status === "error") &&
          sessionRef.current.state.reason === "identity-change",
      });
      return attemptId;
    },
    [replacePending],
  );

  const cancel = useCallback(
    (attemptId: AuthIntentAttemptId) => {
      const record = pendingRecordRef.current;
      if (!record || record.value.attemptId !== attemptId) return false;

      replacePending(null);
      return true;
    },
    [replacePending],
  );

  const claim = useCallback(
    (predicate: (intent: AuthIntent) => boolean): ClaimedAuthIntent | null => {
      const record = pendingRecordRef.current;
      if (!record || !predicate(record.value.intent)) return null;
      if (pendingRecordRef.current !== record) return null;

      if (!isSameSource(record.value.source, currentSourceRef.current)) {
        replacePending(null);
        return null;
      }

      const activeSession = sessionRef.current.captureAuthenticatedSession();
      if (
        !activeSession ||
        !sessionRef.current.isCurrentSession(activeSession)
      ) {
        return null;
      }

      if (
        record.boundSession &&
        !isSameAuthenticatedSessionScope(record.boundSession, activeSession)
      ) {
        replacePending(null);
        return null;
      }

      if (pendingRecordRef.current !== record) return null;

      replacePending(null);
      return Object.freeze({
        ...record.value,
        session: activeSession,
      });
    },
    [replacePending],
  ) as ClaimAuthIntent;

  useEffect(() => {
    const record = pendingRecordRef.current;
    if (!record) return;

    if (!isSameSource(record.value.source, currentSource)) {
      replacePending(null);
    }
  }, [currentSource, replacePending]);

  useEffect(() => {
    const previousState = previousSessionStateRef.current;
    previousSessionStateRef.current = session.state;

    const record = pendingRecordRef.current;
    if (!record) return;

    const activeSession = session.captureAuthenticatedSession();
    if (record.boundSession) {
      if (
        !activeSession ||
        !session.isCurrentSession(record.boundSession) ||
        !isSameAuthenticatedSessionScope(record.boundSession, activeSession)
      ) {
        replacePending(null);
      }
      return;
    }

    if (activeSession) {
      pendingRecordRef.current = {
        ...record,
        boundSession: activeSession,
      };
      return;
    }

    if (
      (session.state.status === "checking" ||
        session.state.status === "error") &&
      session.state.reason === "identity-change" &&
      !record.anonymousLoginAttemptObserved
    ) {
      pendingRecordRef.current = {
        ...record,
        anonymousLoginAttemptObserved: true,
      };
      return;
    }

    if (session.state.status !== "anonymous") return;

    if (session.state.reason === "logout") {
      replacePending(null);
      return;
    }

    if (session.state.reason !== "server-revoked") return;

    const followsAnonymousLoginFailure =
      (previousState.status === "checking" ||
        previousState.status === "error") &&
      previousState.reason === "identity-change";
    if (record.anonymousLoginAttemptObserved || followsAnonymousLoginFailure) {
      if (!record.anonymousLoginAttemptObserved) {
        pendingRecordRef.current = {
          ...record,
          anonymousLoginAttemptObserved: true,
        };
      }
      return;
    }

    replacePending(null);
  }, [replacePending, session]);

  useEffect(
    () => () => {
      pendingRecordRef.current = null;
    },
    [],
  );

  const value = useMemo<AuthIntentContextValue>(
    () => ({ pending, request, cancel, claim }),
    [cancel, claim, pending, request],
  );

  return (
    <AuthIntentContext.Provider value={value}>
      {children}
    </AuthIntentContext.Provider>
  );
}
