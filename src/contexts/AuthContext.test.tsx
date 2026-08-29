import { act, renderHook } from "@testing-library/react";
import React from "react";
import type { SessionContextValue } from "../app/session/SessionProvider";
import {
  toSessionSubject,
  type SessionState,
  type SessionViewer,
} from "../app/session/sessionState";
import { useSession } from "../app/session/useSession";
import { AppError } from "../platform/http/errors";
import { AuthProvider, useAuth } from "./AuthContext";

jest.mock("../app/session/useSession", () => ({
  useSession: jest.fn(),
}));

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

const viewer: SessionViewer = {
  id: 41,
  email: "guest@example.com",
  nickname: "Guest",
  thumbnail_image_url: null,
};

const sessionError = new AppError({
  kind: "network",
  code: "SESSION_CHECK_FAILED",
  message: "Session check failed.",
  retryable: true,
});

const states = {
  checking: {
    status: "checking",
    reason: "bootstrap",
    operationId: 1,
    epoch: 0,
  },
  authenticated: {
    status: "authenticated",
    viewer,
    subject: toSessionSubject(viewer),
    epoch: 2,
    revalidation: { status: "idle" },
  },
  revalidating: {
    status: "authenticated",
    viewer,
    subject: toSessionSubject(viewer),
    epoch: 2,
    revalidation: { status: "checking", operationId: 3 },
  },
  revalidationError: {
    status: "authenticated",
    viewer,
    subject: toSessionSubject(viewer),
    epoch: 2,
    revalidation: {
      status: "error",
      operationId: 3,
      error: sessionError,
    },
  },
  anonymous: {
    status: "anonymous",
    reason: "bootstrap",
    revocation: "verified",
    operationId: 1,
    epoch: 0,
  },
  error: {
    status: "error",
    reason: "bootstrap",
    operationId: 1,
    epoch: 0,
    error: sessionError,
    retryable: true,
  },
} satisfies Record<string, SessionState>;

const createSessionValue = (
  state: SessionState,
): jest.Mocked<SessionContextValue> =>
  ({
    state,
    login: jest.fn(),
    logout: jest.fn(),
    revalidate: jest.fn(),
    retryServerLogout: jest.fn(),
    captureAuthenticatedSession: jest.fn(),
    isCurrentSession: jest.fn(),
  }) as jest.Mocked<SessionContextValue>;

const renderUseAuth = (session: jest.Mocked<SessionContextValue>) => {
  mockUseSession.mockReturnValue(session);

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  return renderHook(() => useAuth(), { wrapper });
};

describe("AuthProvider session compatibility projection", () => {
  beforeEach(() => {
    mockUseSession.mockReset();
  });

  it.each([
    ["checking", states.checking, false, true],
    ["authenticated", states.authenticated, true, false],
    ["authenticated revalidation", states.revalidating, true, false],
    [
      "authenticated revalidation error",
      states.revalidationError,
      true,
      false,
    ],
    ["anonymous", states.anonymous, false, false],
    ["bootstrap error", states.error, false, false],
  ])(
    "projects %s state to the legacy booleans",
    (_name, state, isAuthenticated, isLoading) => {
      const { result } = renderUseAuth(createSessionValue(state));

      expect(result.current.isAuthenticated).toBe(isAuthenticated);
      expect(result.current.isLoading).toBe(isLoading);
    },
  );

  it("delegates login with the exact credentials and promise", async () => {
    const session = createSessionValue(states.anonymous);
    const credentials = {
      email: "guest@example.com",
      password: "password123",
    };
    const delegatedPromise = Promise.resolve();
    session.login.mockReturnValue(delegatedPromise);
    const { result } = renderUseAuth(session);

    const returnedPromise = result.current.login(credentials);

    expect(returnedPromise).toBe(delegatedPromise);
    expect(session.login).toHaveBeenCalledTimes(1);
    expect(session.login).toHaveBeenCalledWith(credentials);
    await act(async () => returnedPromise);
  });

  it("delegates logout without adding behavior", async () => {
    const session = createSessionValue(states.authenticated);
    const delegatedPromise = Promise.resolve();
    session.logout.mockReturnValue(delegatedPromise);
    const { result } = renderUseAuth(session);

    const returnedPromise = result.current.logout();

    expect(returnedPromise).toBe(delegatedPromise);
    expect(session.logout).toHaveBeenCalledTimes(1);
    await act(async () => returnedPromise);
  });

  it("maps checkAuth only to session revalidation", async () => {
    const session = createSessionValue(states.authenticated);
    const delegatedPromise = Promise.resolve();
    session.revalidate.mockReturnValue(delegatedPromise);
    const { result } = renderUseAuth(session);

    const returnedPromise = result.current.checkAuth();

    expect(returnedPromise).toBe(delegatedPromise);
    expect(session.revalidate).toHaveBeenCalledTimes(1);
    expect(session.retryServerLogout).not.toHaveBeenCalled();
    await act(async () => returnedPromise);
  });
});
