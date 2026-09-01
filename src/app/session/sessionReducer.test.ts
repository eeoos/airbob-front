import { AppError } from "../../platform/http/errors";
import type { SessionRuntimeLeaseId } from "../../platform/session/runtimeLeaseId";
import {
  createInitialSessionState,
  toAuthenticatedSessionScope,
  toSessionSubject,
  type SessionAuthenticatedState,
  type SessionState,
  type SessionViewer,
} from "./sessionState";
import { sessionReducer, type SessionAction } from "./sessionReducer";

const viewerA: SessionViewer = {
  id: 101,
  email: "person-a@example.invalid",
  nickname: "Person A",
  thumbnailImageUrl: null,
};

const viewerAUpdated: SessionViewer = {
  ...viewerA,
  nickname: "Person A Updated",
};

const viewerB: SessionViewer = {
  id: 202,
  email: "person-b@example.invalid",
  nickname: "Person B",
  thumbnailImageUrl: "https://images.example.invalid/person-b.png",
};

const retryableError = new AppError({
  kind: "server",
  code: "SESSION_CHECK_FAILED",
  message: "Session check failed.",
  retryable: true,
});

const anotherRetryableError = new AppError({
  kind: "network",
  code: "NETWORK_ERROR",
  message: "Network failed.",
  retryable: true,
});

const runtimeLeaseId =
  "10000000-0000-4000-8000-000000000001" as SessionRuntimeLeaseId;

const nonRetryableError = new AppError({
  kind: "invalid-response",
  code: "INVALID_SESSION_RESPONSE",
  message: "Invalid session response.",
});

const authenticatedState = (
  viewer: SessionViewer = viewerA,
  epoch = 4,
): SessionAuthenticatedState => ({
  status: "authenticated",
  viewer,
  subject: toSessionSubject(viewer),
  epoch,
  revalidation: { status: "idle" },
});

interface TransitionCase {
  name: string;
  state: SessionState;
  action: SessionAction;
  expected: SessionState;
}

describe("sessionReducer accepted transitions", () => {
  const initialChecking = createInitialSessionState({
    epoch: 0,
    operationId: 1,
  });
  const authenticated = authenticatedState();
  const revalidating: SessionState = {
    ...authenticated,
    revalidation: { status: "checking", operationId: 8 },
  };
  const revalidationError: SessionState = {
    ...authenticated,
    revalidation: {
      status: "error",
      operationId: 8,
      error: retryableError,
    },
  };
  const identityChangeChecking: SessionState = {
    status: "checking",
    reason: "identity-change",
    operationId: 8,
    epoch: 5,
  };
  const logoutPending: SessionState = {
    status: "anonymous",
    reason: "logout",
    revocation: "unverified",
    operationId: 9,
    epoch: 5,
  };

  const transitionCases: TransitionCase[] = [
    {
      name: "publishes a successful bootstrap without advancing its epoch",
      state: initialChecking,
      action: {
        type: "session/check-succeeded",
        operationId: 1,
        epoch: 0,
        viewer: viewerA,
      },
      expected: authenticatedState(viewerA, 0),
    },
    {
      name: "publishes a verified anonymous bootstrap",
      state: initialChecking,
      action: {
        type: "session/check-anonymous",
        operationId: 1,
        epoch: 0,
      },
      expected: {
        status: "anonymous",
        reason: "bootstrap",
        revocation: "verified",
        operationId: 1,
        epoch: 0,
      },
    },
    {
      name: "publishes a retryable bootstrap error",
      state: initialChecking,
      action: {
        type: "session/check-failed",
        operationId: 1,
        epoch: 0,
        error: retryableError,
      },
      expected: {
        status: "error",
        reason: "bootstrap",
        operationId: 1,
        epoch: 0,
        error: retryableError,
        retryable: true,
      },
    },
    {
      name: "keeps bootstrap failure retryable when its source error is terminal",
      state: initialChecking,
      action: {
        type: "session/check-failed",
        operationId: 1,
        epoch: 0,
        error: nonRetryableError,
      },
      expected: {
        status: "error",
        reason: "bootstrap",
        operationId: 1,
        epoch: 0,
        error: nonRetryableError,
        retryable: true,
      },
    },
    {
      name: "retries a bootstrap error without advancing its epoch",
      state: {
        status: "error",
        reason: "bootstrap",
        operationId: 1,
        epoch: 0,
        error: retryableError,
        retryable: true,
      },
      action: {
        type: "session/check-started",
        reason: "bootstrap",
        operationId: 2,
        epoch: 0,
      },
      expected: {
        status: "checking",
        reason: "bootstrap",
        operationId: 2,
        epoch: 0,
      },
    },
    {
      name: "advances the epoch before an external session check",
      state: authenticated,
      action: {
        type: "session/check-started",
        reason: "external-change",
        operationId: 7,
        epoch: 4,
      },
      expected: {
        status: "checking",
        reason: "external-change",
        operationId: 7,
        epoch: 5,
      },
    },
    {
      name: "advances the epoch before an explicit identity change",
      state: authenticated,
      action: {
        type: "session/check-started",
        reason: "identity-change",
        operationId: 7,
        epoch: 4,
      },
      expected: {
        status: "checking",
        reason: "identity-change",
        operationId: 7,
        epoch: 5,
      },
    },
    {
      name: "publishes a checked external identity at the advanced epoch",
      state: {
        status: "checking",
        reason: "external-change",
        operationId: 7,
        epoch: 5,
      },
      action: {
        type: "session/check-succeeded",
        operationId: 7,
        epoch: 5,
        viewer: viewerB,
      },
      expected: authenticatedState(viewerB, 5),
    },
    {
      name: "maps a non-bootstrap anonymous check to server revocation",
      state: {
        status: "checking",
        reason: "external-change",
        operationId: 7,
        epoch: 5,
      },
      action: {
        type: "session/check-anonymous",
        operationId: 7,
        epoch: 5,
      },
      expected: {
        status: "anonymous",
        reason: "server-revoked",
        revocation: "verified",
        operationId: 7,
        epoch: 5,
      },
    },
    {
      name: "starts authenticated revalidation without advancing its epoch",
      state: authenticated,
      action: {
        type: "session/revalidation-started",
        operationId: 8,
        epoch: 4,
      },
      expected: revalidating,
    },
    {
      name: "publishes a same-subject revalidation without advancing its epoch",
      state: revalidating,
      action: {
        type: "session/revalidation-succeeded",
        operationId: 8,
        epoch: 4,
        viewer: viewerAUpdated,
      },
      expected: authenticatedState(viewerAUpdated, 4),
    },
    {
      name: "enters identity-change checking before publishing another subject",
      state: revalidating,
      action: {
        type: "session/revalidation-succeeded",
        operationId: 8,
        epoch: 4,
        viewer: viewerB,
      },
      expected: identityChangeChecking,
    },
    {
      name: "publishes a reconciled identity only from identity-change checking",
      state: identityChangeChecking,
      action: {
        type: "session/identity-published",
        operationId: 8,
        epoch: 5,
        viewer: viewerB,
      },
      expected: authenticatedState(viewerB, 5),
    },
    {
      name: "retains the viewer and epoch on revalidation failure",
      state: revalidating,
      action: {
        type: "session/revalidation-failed",
        operationId: 8,
        epoch: 4,
        error: retryableError,
      },
      expected: revalidationError,
    },
    {
      name: "retries revalidation by replacing its error substate",
      state: revalidationError,
      action: {
        type: "session/revalidation-started",
        operationId: 9,
        epoch: 4,
      },
      expected: {
        ...authenticated,
        revalidation: { status: "checking", operationId: 9 },
      },
    },
    {
      name: "publishes local anonymous state and advances the epoch on logout",
      state: authenticated,
      action: {
        type: "session/logout-started",
        operationId: 9,
        epoch: 4,
      },
      expected: logoutPending,
    },
    {
      name: "marks server logout as verified without changing other state",
      state: logoutPending,
      action: {
        type: "session/logout-settled",
        operationId: 9,
        epoch: 5,
        revocation: "verified",
      },
      expected: { ...logoutPending, revocation: "verified" },
    },
    {
      name: "records a safe error when server logout remains unverified",
      state: logoutPending,
      action: {
        type: "session/logout-settled",
        operationId: 9,
        epoch: 5,
        revocation: "unverified",
        error: retryableError,
      },
      expected: { ...logoutPending, revocationError: retryableError },
    },
    {
      name: "publishes verified server revocation and advances the epoch",
      state: authenticated,
      action: {
        type: "session/auth-revoked",
        operationId: 10,
        epoch: 4,
      },
      expected: {
        status: "anonymous",
        reason: "server-revoked",
        revocation: "verified",
        operationId: 10,
        epoch: 5,
      },
    },
    {
      name: "retains bootstrap provenance when its auth request is revoked",
      state: initialChecking,
      action: {
        type: "session/auth-revoked",
        operationId: 10,
        epoch: 0,
      },
      expected: {
        status: "anonymous",
        reason: "bootstrap",
        revocation: "verified",
        operationId: 10,
        epoch: 1,
      },
    },
    {
      name: "upgrades an unverified logout when server revocation is observed",
      state: logoutPending,
      action: {
        type: "session/auth-revoked",
        operationId: 10,
        epoch: 5,
      },
      expected: { ...logoutPending, revocation: "verified" },
    },
  ];

  it.each(transitionCases)("$name", ({ state, action, expected }) => {
    expect(sessionReducer(state, action)).toEqual(expected);
  });
});

describe("sessionReducer stale completion fences", () => {
  const checking = createInitialSessionState({ epoch: 3, operationId: 11 });
  const authenticated = authenticatedState(viewerA, 3);
  const revalidating: SessionState = {
    ...authenticated,
    revalidation: { status: "checking", operationId: 12 },
  };
  const identityChecking: SessionState = {
    status: "checking",
    reason: "identity-change",
    operationId: 12,
    epoch: 4,
  };
  const logoutPending: SessionState = {
    status: "anonymous",
    reason: "logout",
    revocation: "unverified",
    operationId: 13,
    epoch: 4,
  };

  const staleCases: Array<{
    name: string;
    state: SessionState;
    action: SessionAction;
  }> = [
    {
      name: "check success from an older operation",
      state: checking,
      action: {
        type: "session/check-succeeded",
        operationId: 10,
        epoch: 3,
        viewer: viewerA,
      },
    },
    {
      name: "check success from an older epoch",
      state: checking,
      action: {
        type: "session/check-succeeded",
        operationId: 11,
        epoch: 2,
        viewer: viewerA,
      },
    },
    {
      name: "anonymous completion from an older operation",
      state: checking,
      action: {
        type: "session/check-anonymous",
        operationId: 10,
        epoch: 3,
      },
    },
    {
      name: "failed check from an older epoch",
      state: checking,
      action: {
        type: "session/check-failed",
        operationId: 11,
        epoch: 2,
        error: retryableError,
      },
    },
    {
      name: "revalidation success from an older operation",
      state: revalidating,
      action: {
        type: "session/revalidation-succeeded",
        operationId: 11,
        epoch: 3,
        viewer: viewerA,
      },
    },
    {
      name: "revalidation failure from an older epoch",
      state: revalidating,
      action: {
        type: "session/revalidation-failed",
        operationId: 12,
        epoch: 2,
        error: retryableError,
      },
    },
    {
      name: "identity publication from an older operation",
      state: identityChecking,
      action: {
        type: "session/identity-published",
        operationId: 11,
        epoch: 4,
        viewer: viewerB,
      },
    },
    {
      name: "identity publication from an older epoch",
      state: identityChecking,
      action: {
        type: "session/identity-published",
        operationId: 12,
        epoch: 3,
        viewer: viewerB,
      },
    },
    {
      name: "direct check publication during identity reconciliation",
      state: identityChecking,
      action: {
        type: "session/check-succeeded",
        operationId: 12,
        epoch: 4,
        viewer: viewerB,
      },
    },
    {
      name: "logout settlement from an older operation",
      state: logoutPending,
      action: {
        type: "session/logout-settled",
        operationId: 12,
        epoch: 4,
        revocation: "verified",
      },
    },
    {
      name: "logout settlement from an older epoch",
      state: logoutPending,
      action: {
        type: "session/logout-settled",
        operationId: 13,
        epoch: 3,
        revocation: "verified",
      },
    },
    {
      name: "revalidation start from an older epoch",
      state: authenticated,
      action: {
        type: "session/revalidation-started",
        operationId: 13,
        epoch: 2,
      },
    },
    {
      name: "logout start from an older epoch",
      state: authenticated,
      action: {
        type: "session/logout-started",
        operationId: 13,
        epoch: 2,
      },
    },
    {
      name: "auth revocation from an older epoch",
      state: authenticated,
      action: {
        type: "session/auth-revoked",
        operationId: 13,
        epoch: 2,
      },
    },
  ];

  it.each(staleCases)("ignores $name", ({ state, action }) => {
    expect(sessionReducer(state, action)).toBe(state);
  });
});

describe("session state contracts", () => {
  it("creates a stable opaque subject without viewer PII", () => {
    const subject = toSessionSubject(viewerA);

    expect(subject).toBe(toSessionSubject(viewerAUpdated));
    expect(subject).toMatch(/^subject:[A-Za-z0-9_-]{3,128}$/);
    expect(subject).not.toContain(viewerA.email);
    expect(subject).not.toContain(viewerA.nickname);
  });

  it("rejects a viewer id that cannot be a stable subject", () => {
    expect(() => toSessionSubject({ ...viewerA, id: 0 })).toThrow(TypeError);
    expect(() =>
      toSessionSubject({ ...viewerA, id: Number.MAX_SAFE_INTEGER + 1 }),
    ).toThrow(TypeError);
  });

  it("captures authenticated identity with its runtime authority", () => {
    expect(
      toAuthenticatedSessionScope(
        authenticatedState(viewerA, 7),
        runtimeLeaseId,
      ),
    ).toEqual({
      subject: toSessionSubject(viewerA),
      epoch: 7,
      runtimeLeaseId,
    });
    expect(
      toAuthenticatedSessionScope(
        createInitialSessionState({ epoch: 7, operationId: 1 }),
        runtimeLeaseId,
      ),
    ).toBeNull();
  });

  it("does not advance an already terminal anonymous session on duplicate revocation", () => {
    const state: SessionState = {
      status: "anonymous",
      reason: "server-revoked",
      revocation: "verified",
      operationId: 4,
      epoch: 8,
    };

    expect(
      sessionReducer(state, {
        type: "session/auth-revoked",
        operationId: 5,
        epoch: 8,
      }),
    ).toBe(state);
  });

  it("publishes an observable logout boundary from an anonymous terminal", () => {
    const state: SessionState = {
      status: "anonymous",
      reason: "bootstrap",
      revocation: "verified",
      operationId: 1,
      epoch: 0,
    };

    expect(
      sessionReducer(state, {
        type: "session/logout-started",
        operationId: 2,
        epoch: 0,
      }),
    ).toEqual({
      status: "anonymous",
      reason: "logout",
      revocation: "unverified",
      operationId: 2,
      epoch: 1,
    });
  });

  it("replaces a revalidation error with the latest accepted error", () => {
    const state: SessionState = {
      ...authenticatedState(viewerA, 3),
      revalidation: { status: "checking", operationId: 20 },
    };

    expect(
      sessionReducer(state, {
        type: "session/revalidation-failed",
        operationId: 20,
        epoch: 3,
        error: anotherRetryableError,
      }),
    ).toEqual({
      ...authenticatedState(viewerA, 3),
      revalidation: {
        status: "error",
        operationId: 20,
        error: anotherRetryableError,
      },
    });
  });

  it("removes the logout failure when server revocation is later verified", () => {
    const state: SessionState = {
      status: "anonymous",
      reason: "logout",
      revocation: "unverified",
      revocationError: retryableError,
      operationId: 30,
      epoch: 9,
    };

    expect(
      sessionReducer(state, {
        type: "session/logout-settled",
        operationId: 30,
        epoch: 9,
        revocation: "verified",
      }),
    ).toEqual({
      status: "anonymous",
      reason: "logout",
      revocation: "verified",
      operationId: 30,
      epoch: 9,
    });
  });

  it("does not downgrade verified logout revocation after a stale failure", () => {
    const state: SessionState = {
      status: "anonymous",
      reason: "logout",
      revocation: "verified",
      operationId: 30,
      epoch: 9,
    };

    expect(
      sessionReducer(state, {
        type: "session/logout-settled",
        operationId: 30,
        epoch: 9,
        revocation: "unverified",
        error: retryableError,
      }),
    ).toBe(state);
  });

  it("clears a logout failure when an auth response verifies revocation", () => {
    const state: SessionState = {
      status: "anonymous",
      reason: "logout",
      revocation: "unverified",
      revocationError: retryableError,
      operationId: 31,
      epoch: 10,
    };

    expect(
      sessionReducer(state, {
        type: "session/auth-revoked",
        operationId: 32,
        epoch: 10,
      }),
    ).toEqual({
      status: "anonymous",
      reason: "logout",
      revocation: "verified",
      operationId: 31,
      epoch: 10,
    });
  });
});
