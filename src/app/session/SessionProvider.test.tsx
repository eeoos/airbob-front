import {
  QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  act,
  fireEvent,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import React, { type ReactNode, useEffect } from "react";
import { ApiClientError } from "../../api/response";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import type {
  SessionAuthPort,
  SessionCredentials,
} from "../../features/auth/ports/sessionPort";
import type {
  SessionBroadcast,
  SessionBroadcastListener,
  SessionBroadcastMessage,
  SessionBroadcastPhase,
} from "../../platform/session/sessionBroadcast";
import { AppError } from "../../platform/http/errors";
import { triggerAuthError } from "../../utils/authEvents";
import {
  SessionProvider,
  type SessionProviderProps,
  type SessionQueryClientFactory,
} from "./SessionProvider";
import {
  toSessionSubject,
  type SessionState,
  type SessionViewer,
} from "./sessionState";
import { useSession } from "./useSession";

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

const deferred = <T,>(): Deferred<T> => {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: resolvePromise,
  };
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const viewerA: SessionViewer = {
  id: 1,
  email: "user-a@example.com",
  nickname: "User A",
  thumbnailImageUrl: null,
};

const viewerAUpdated: SessionViewer = {
  ...viewerA,
  nickname: "User A Updated",
};

const viewerB: SessionViewer = {
  id: 2,
  email: "user-b@example.com",
  nickname: "User B",
  thumbnailImageUrl: null,
};

const viewerC: SessionViewer = {
  id: 3,
  email: "user-c@example.com",
  nickname: "User C",
  thumbnailImageUrl: null,
};

const credentialsA: SessionCredentials = {
  email: viewerA.email,
  password: "password-a",
};

const credentialsB: SessionCredentials = {
  email: viewerB.email,
  password: "password-b",
};

const authenticatedState = (
  viewer: SessionViewer,
  epoch = 4,
): SessionState => ({
  status: "authenticated",
  viewer,
  subject: toSessionSubject(viewer),
  epoch,
  revalidation: { status: "idle" },
});

const anonymousState = (epoch = 4): SessionState => ({
  status: "anonymous",
  reason: "bootstrap",
  revocation: "verified",
  operationId: 0,
  epoch,
});

const retryableErrorState = (epoch = 4): SessionState => ({
  status: "error",
  reason: "bootstrap",
  operationId: 0,
  epoch,
  error: new AppError({
    kind: "server",
    code: "SESSION_CHECK_FAILED",
    message: "Session check failed.",
    retryable: true,
  }),
  retryable: true,
});

const authenticationError = () =>
  new ApiClientError({
    status: 401,
    code: "M004",
    message: "Authentication is required.",
  });

const serverError = (message = "Server unavailable") =>
  new ApiClientError({
    status: 503,
    code: "SERVICE_UNAVAILABLE",
    message,
  });

const createAuthPort = (): jest.Mocked<SessionAuthPort> => ({
  getViewer: jest.fn<Promise<SessionViewer>, [AbortSignal?]>(),
  login: jest.fn<Promise<void>, [SessionCredentials, AbortSignal?]>(() =>
    Promise.resolve(),
  ),
  logout: jest.fn<Promise<void>, [AbortSignal?]>(() => Promise.resolve()),
});

type QueryScope = Parameters<SessionQueryClientFactory>[0];

interface TrackedQueryClient {
  readonly scope: QueryScope;
  readonly client: QueryClient;
  readonly cancelQueries: jest.SpyInstance<
    ReturnType<QueryClient["cancelQueries"]>,
    Parameters<QueryClient["cancelQueries"]>
  >;
  readonly clear: jest.SpyInstance<
    ReturnType<QueryClient["clear"]>,
    Parameters<QueryClient["clear"]>
  >;
}

const createTrackedQueryClients = () => {
  const generations: TrackedQueryClient[] = [];
  const factory: SessionQueryClientFactory = jest.fn((scope) => {
    const sessionMeta = { session: { ...scope } };
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
          meta: sessionMeta,
        },
        mutations: { retry: false, meta: sessionMeta },
      },
    });
    const record: TrackedQueryClient = {
      scope,
      client,
      cancelQueries: jest.spyOn(client, "cancelQueries"),
      clear: jest.spyOn(client, "clear"),
    };
    generations.push(record);
    return client;
  });

  return { factory, generations };
};

class FakeSessionBroadcast implements SessionBroadcast {
  readonly published: SessionBroadcastPhase[] = [];
  readonly listeners = new Set<SessionBroadcastListener>();
  readonly publish = jest.fn((phase: SessionBroadcastPhase) => {
    if (!this.closed) this.published.push(phase);
  });
  readonly subscribe = jest.fn((listener: SessionBroadcastListener) => {
    if (!this.closed) this.listeners.add(listener);
    let subscribed = true;

    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(listener);
    };
  });
  readonly close = jest.fn(() => {
    if (this.closed) return;
    this.closed = true;
    this.listeners.clear();
  });
  closed = false;
  private sequence = 0;

  emit(phase: SessionBroadcastPhase) {
    if (this.closed) return;

    const message: SessionBroadcastMessage = {
      version: 1,
      type: "session-transition",
      sourceId: "tab_remote_0001",
      sequence: ++this.sequence,
      phase,
    };
    Array.from(this.listeners).forEach((listener) => listener(message));
  }
}

interface RenderSessionOptions {
  readonly authPort: SessionAuthPort;
  readonly broadcastFactory?: () => SessionBroadcast;
  readonly clearIdentityOwnedState?: () => void;
  readonly initialState?: SessionState;
  readonly queryClientFactory?: SessionQueryClientFactory;
}

const createWrapper = ({
  authPort,
  broadcastFactory,
  clearIdentityOwnedState,
  initialState,
  queryClientFactory,
}: RenderSessionOptions) => {
  const broadcast = new FakeSessionBroadcast();
  const props: Omit<SessionProviderProps, "children"> = {
    authPort,
    broadcastFactory: broadcastFactory ?? (() => broadcast),
    clearIdentityOwnedState,
    initialState,
    queryClientFactory,
  };

  return ({ children }: { readonly children: ReactNode }) => {
    return (
      <SessionProvider {...props}>{children}</SessionProvider>
    );
  };
};

const renderSession = (options: RenderSessionOptions) =>
  renderHook(
    () => ({ session: useSession(), queryClient: useQueryClient() }),
    { wrapper: createWrapper(options) },
  );

const expectAuthenticatedAs = (
  state: SessionState,
  expectedViewer: SessionViewer,
) => {
  expect(state.status).toBe("authenticated");
  if (state.status !== "authenticated") return;

  expect(state.viewer).toEqual(expectedViewer);
  expect(state.subject).toBe(toSessionSubject(expectedViewer));
};

interface ChildLifecycleCounts {
  mounts: number;
  unmounts: number;
}

function ChildLifecycleProbe({
  counts,
}: {
  readonly counts: ChildLifecycleCounts;
}) {
  useEffect(() => {
    counts.mounts += 1;

    return () => {
      counts.unmounts += 1;
    };
  }, [counts]);

  return null;
}

describe("SessionProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.cookie = "SESSION_ID=; Max-Age=0; path=/";
  });

  afterEach(() => {
    document.cookie = "SESSION_ID=; Max-Age=0; path=/";
    jest.restoreAllMocks();
  });

  it("publishes bootstrap checking while the viewer probe is pending", async () => {
    const authPort = createAuthPort();
    const viewerProbe = deferred<SessionViewer>();
    authPort.getViewer.mockReturnValueOnce(viewerProbe.promise);

    const { result } = renderSession({ authPort });

    expect(result.current.session.state).toMatchObject({
      status: "checking",
      reason: "bootstrap",
      epoch: 0,
    });
    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(1));
    expect(authPort.getViewer.mock.calls[0][0]).toBeInstanceOf(AbortSignal);

    await act(async () => {
      viewerProbe.resolve(viewerA);
      await viewerProbe.promise;
    });

    await waitFor(() =>
      expectAuthenticatedAs(result.current.session.state, viewerA),
    );
  });

  it("settles a bootstrap 401 as verified anonymous", async () => {
    const authPort = createAuthPort();
    authPort.getViewer.mockRejectedValueOnce(authenticationError());

    const { result } = renderSession({ authPort });

    await waitFor(() =>
      expect(result.current.session.state).toMatchObject({
        status: "anonymous",
        reason: "bootstrap",
        revocation: "verified",
        epoch: 0,
      }),
    );
  });

  it("exposes a retryable bootstrap server error and recovers through revalidate", async () => {
    const authPort = createAuthPort();
    authPort.getViewer
      .mockRejectedValueOnce(serverError())
      .mockResolvedValueOnce(viewerA);

    const { result } = renderSession({ authPort });

    await waitFor(() =>
      expect(result.current.session.state.status).toBe("error"),
    );
    const failedState = result.current.session.state;
    expect(failedState).toMatchObject({
      status: "error",
      reason: "bootstrap",
      retryable: true,
      error: {
        kind: "server",
        retryable: true,
        status: 503,
      },
    });

    await act(async () => {
      await result.current.session.revalidate();
    });

    expect(authPort.getViewer).toHaveBeenCalledTimes(2);
    expectAuthenticatedAs(result.current.session.state, viewerA);
  });

  it("keeps SessionProvider as the single viewer owner with the legacy AuthProvider adapter", async () => {
    const authPort = createAuthPort();
    authPort.getViewer.mockResolvedValue(viewerA);
    const queryClients = createTrackedQueryClients();
    const Wrapper = createWrapper({
      authPort,
      queryClientFactory: queryClients.factory,
    });
    const legacyWrapper = ({ children }: { readonly children: ReactNode }) => (
      <Wrapper>
        <AuthProvider>{children}</AuthProvider>
      </Wrapper>
    );

    const { result } = renderHook(
      () => ({ session: useSession(), legacy: useAuth() }),
      { wrapper: legacyWrapper },
    );

    await waitFor(() => expect(result.current.legacy.isLoading).toBe(false));
    expect(result.current.legacy.isAuthenticated).toBe(true);
    expect(authPort.getViewer).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.legacy.checkAuth();
    });

    expect(authPort.getViewer).toHaveBeenCalledTimes(2);
    expectAuthenticatedAs(result.current.session.state, viewerA);
  });

  it("preserves the viewer and QueryClient when same-subject revalidation gets a server error", async () => {
    const authPort = createAuthPort();
    const failure = serverError("same subject revalidation failed");
    authPort.getViewer.mockRejectedValueOnce(failure);
    const queryClients = createTrackedQueryClients();
    const { result } = renderSession({
      authPort,
      initialState: authenticatedState(viewerA),
      queryClientFactory: queryClients.factory,
    });
    const originalClient = result.current.queryClient;

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.session.revalidate();
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBe(failure);
    expectAuthenticatedAs(result.current.session.state, viewerA);
    expect(result.current.session.state).toMatchObject({
      status: "authenticated",
      revalidation: {
        status: "error",
        error: { kind: "server", retryable: true },
      },
    });
    expect(result.current.queryClient).toBe(originalClient);
    expect(queryClients.generations).toHaveLength(1);
    expect(queryClients.generations[0].cancelQueries).not.toHaveBeenCalled();
    expect(queryClients.generations[0].clear).not.toHaveBeenCalled();
  });

  it("does not publish a different viewer until the old QueryClient is cancelled and cleared", async () => {
    const authPort = createAuthPort();
    authPort.getViewer.mockResolvedValueOnce(viewerB);
    const queryClients = createTrackedQueryClients();
    const cancelGate = deferred<void>();
    const { result } = renderSession({
      authPort,
      initialState: authenticatedState(viewerA),
      queryClientFactory: queryClients.factory,
    });
    const original = queryClients.generations[0];
    original.cancelQueries.mockImplementation(() => cancelGate.promise);

    let revalidation!: Promise<void>;
    act(() => {
      revalidation = result.current.session.revalidate();
    });

    await waitFor(() => expect(original.cancelQueries).toHaveBeenCalledTimes(1));
    expect(original.clear).not.toHaveBeenCalled();
    expect(result.current.session.state).toMatchObject({
      status: "checking",
      reason: "identity-change",
    });
    expect(result.current.session.state.status).not.toBe("authenticated");

    await act(async () => {
      cancelGate.resolve();
      await revalidation;
    });

    expect(original.clear).toHaveBeenCalledTimes(1);
    expectAuthenticatedAs(result.current.session.state, viewerB);
    expect(queryClients.generations.map(({ scope }) => scope)).toEqual([
      { epoch: 4, subject: toSessionSubject(viewerA) },
      { epoch: 5, subject: null },
      { epoch: 5, subject: toSessionSubject(viewerB) },
    ]);
    expect(result.current.queryClient).toBe(
      queryClients.generations[2].client,
    );
  });

  it("aborts an old login locally without letting the next login overtake its server settlement", async () => {
    const authPort = createAuthPort();
    const oldLogin = deferred<void>();
    const currentLogin = deferred<void>();
    authPort.login.mockImplementation((credentials) => {
      return credentials.email === credentialsA.email
        ? oldLogin.promise
        : currentLogin.promise;
    });
    authPort.getViewer.mockResolvedValueOnce(viewerB);
    const { result } = renderSession({
      authPort,
      initialState: anonymousState(),
    });

    let oldOperation!: Promise<void>;
    act(() => {
      oldOperation = result.current.session.login(credentialsA);
    });
    await waitFor(() => expect(authPort.login).toHaveBeenCalledTimes(1));
    const observedOldOperation = oldOperation.catch((error: unknown) => error);

    let currentOperation!: Promise<void>;
    act(() => {
      currentOperation = result.current.session.login(credentialsB);
    });

    let staleCompletionError: unknown;
    await act(async () => {
      staleCompletionError = await observedOldOperation;
    });
    expect(authPort.login).toHaveBeenCalledTimes(1);
    expect(authPort.login.mock.calls[0][1]).toBeUndefined();
    expect(staleCompletionError).toMatchObject({
      kind: "cancelled",
      code: "STALE_SESSION_OPERATION",
    });

    await act(async () => {
      oldLogin.resolve();
      await oldLogin.promise;
    });
    await waitFor(() => expect(authPort.login).toHaveBeenCalledTimes(2));
    expect(authPort.login.mock.calls[1][1]).toBeUndefined();

    await act(async () => {
      currentLogin.resolve();
      await currentOperation;
    });
    expectAuthenticatedAs(result.current.session.state, viewerB);
    expect(authPort.getViewer).toHaveBeenCalledTimes(1);
    expectAuthenticatedAs(result.current.session.state, viewerB);
  });

  it("waits for the A cache fence and quarantine remount before sending a B login", async () => {
    const authPort = createAuthPort();
    const cancelGate = deferred<void>();
    const loginRequest = deferred<void>();
    authPort.login.mockReturnValueOnce(loginRequest.promise);
    authPort.getViewer.mockResolvedValueOnce(viewerB);
    const queryClients = createTrackedQueryClients();
    const counts: ChildLifecycleCounts = { mounts: 0, unmounts: 0 };
    const ProviderWrapper = createWrapper({
      authPort,
      initialState: authenticatedState(viewerA),
      queryClientFactory: queryClients.factory,
    });
    const Wrapper = ({ children }: { readonly children: ReactNode }) => (
      <ProviderWrapper>
        <ChildLifecycleProbe counts={counts} />
        {children}
      </ProviderWrapper>
    );
    const { result } = renderHook(
      () => ({ session: useSession(), queryClient: useQueryClient() }),
      { wrapper: Wrapper },
    );
    const clientA = queryClients.generations[0];
    clientA.cancelQueries.mockImplementation(() => cancelGate.promise);

    let loginOperation!: Promise<void>;
    act(() => {
      loginOperation = result.current.session.login(credentialsB);
    });

    await waitFor(() => expect(clientA.cancelQueries).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queryClients.generations).toHaveLength(2));
    await waitFor(() => expect(counts).toEqual({ mounts: 2, unmounts: 1 }));
    expect(queryClients.generations[1].scope).toEqual({
      epoch: 5,
      subject: null,
    });
    expect(result.current.queryClient).toBe(queryClients.generations[1].client);
    expect(clientA.clear).not.toHaveBeenCalled();
    expect(authPort.login).not.toHaveBeenCalled();

    await act(async () => {
      cancelGate.resolve();
      await cancelGate.promise;
      await flushMicrotasks();
    });

    await waitFor(() => expect(authPort.login).toHaveBeenCalledTimes(1));
    expect(clientA.clear).toHaveBeenCalledTimes(1);
    expect(clientA.clear.mock.invocationCallOrder[0]).toBeLessThan(
      authPort.login.mock.invocationCallOrder[0],
    );
    expect(counts).toEqual({ mounts: 2, unmounts: 1 });
    expect(result.current.queryClient).toBe(queryClients.generations[1].client);

    await act(async () => {
      loginRequest.resolve();
      await loginOperation;
    });

    expectAuthenticatedAs(result.current.session.state, viewerB);
  });

  it("keeps the original login failure while a follow-up 401 verifies anonymous", async () => {
    const authPort = createAuthPort();
    const loginFailure = serverError("login failed");
    authPort.login.mockRejectedValueOnce(loginFailure);
    authPort.getViewer.mockRejectedValueOnce(authenticationError());
    const queryClients = createTrackedQueryClients();
    const { result } = renderSession({
      authPort,
      initialState: anonymousState(),
      queryClientFactory: queryClients.factory,
    });
    const anonymousClient = result.current.queryClient;

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.session.login(credentialsB);
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBe(loginFailure);
    expect(authPort.getViewer).toHaveBeenCalledTimes(1);
    expect(result.current.session.state).toMatchObject({
      status: "anonymous",
      reason: "server-revoked",
      revocation: "verified",
      epoch: 5,
    });
    expect(result.current.queryClient).toBe(anonymousClient);
    expect(queryClients.generations).toHaveLength(1);
    expect(anonymousClient.getDefaultOptions().queries?.meta).toEqual({
      session: { epoch: 5, subject: null },
    });
  });

  it("republishes A through a fresh clean generation after a failed login verifies A", async () => {
    const authPort = createAuthPort();
    const loginFailure = serverError("replacement login failed");
    authPort.login.mockRejectedValueOnce(loginFailure);
    authPort.getViewer.mockResolvedValueOnce(viewerA);
    const queryClients = createTrackedQueryClients();
    const { result } = renderSession({
      authPort,
      initialState: authenticatedState(viewerA),
      queryClientFactory: queryClients.factory,
    });
    const staleKey = ["session-test", "stale-a"] as const;
    queryClients.generations[0].client.setQueryData(staleKey, "old A data");

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.session.login(credentialsB);
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBe(loginFailure);
    expectAuthenticatedAs(result.current.session.state, viewerA);
    expect(queryClients.generations.map(({ scope }) => scope)).toEqual([
      { epoch: 4, subject: toSessionSubject(viewerA) },
      { epoch: 5, subject: null },
      { epoch: 5, subject: toSessionSubject(viewerA) },
    ]);
    expect(queryClients.generations[0].clear).toHaveBeenCalledTimes(1);
    expect(queryClients.generations[1].clear).toHaveBeenCalledTimes(1);
    const freshA = queryClients.generations[2].client;
    expect(result.current.queryClient).toBe(freshA);
    expect(freshA).not.toBe(queryClients.generations[0].client);
    expect(freshA.getQueryData(staleKey)).toBeUndefined();
  });

  it("uses abort signals only for viewer probes, not cookie-mutating commands", async () => {
    const authPort = createAuthPort();
    authPort.login.mockResolvedValueOnce(undefined);
    authPort.getViewer.mockResolvedValueOnce(viewerB);
    authPort.logout.mockResolvedValueOnce(undefined);
    const { result } = renderSession({
      authPort,
      initialState: anonymousState(),
    });

    await act(async () => {
      await result.current.session.login(credentialsB);
    });
    await act(async () => {
      await result.current.session.logout();
    });

    expect(authPort.login).toHaveBeenCalledWith(credentialsB);
    expect(authPort.login.mock.calls[0][1]).toBeUndefined();
    expect(authPort.logout).toHaveBeenCalledWith();
    expect(authPort.logout.mock.calls[0][0]).toBeUndefined();
    expect(authPort.getViewer.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it("fences anonymous cache and in-flight work before publishing B", async () => {
    const authPort = createAuthPort();
    authPort.getViewer.mockResolvedValueOnce(viewerB);
    const queryClients = createTrackedQueryClients();
    const anonymousQuery = deferred<string>();
    const anonymousMutation = deferred<string>();
    const counts: ChildLifecycleCounts = { mounts: 0, unmounts: 0 };
    const ProviderWrapper = createWrapper({
      authPort,
      initialState: anonymousState(),
      queryClientFactory: queryClients.factory,
    });
    const Wrapper = ({ children }: { readonly children: ReactNode }) => (
      <ProviderWrapper>
        <ChildLifecycleProbe counts={counts} />
        {children}
      </ProviderWrapper>
    );
    const cachedKey = ["session-test", "anonymous-cache"] as const;
    const queryKey = ["session-test", "anonymous-query"] as const;
    const mutationKey = ["session-test", "anonymous-mutation"] as const;
    const { result } = renderHook(() => {
      const session = useSession();
      const queryClient = useQueryClient();
      const mutation = useMutation<string, Error, void>({
        mutationFn: () => anonymousMutation.promise,
        onSuccess: (value) => {
          queryClient.setQueryData(mutationKey, value);
        },
      });

      return { mutation, queryClient, session };
    }, { wrapper: Wrapper });
    const anonymousClient = result.current.queryClient;
    anonymousClient.setQueryData(cachedKey, "anonymous cached data");
    const anonymousQueryCompletion = anonymousClient
      .fetchQuery({
        queryKey,
        queryFn: () => anonymousQuery.promise,
      })
      .catch(() => undefined);
    let anonymousMutationCompletion!: Promise<string>;
    act(() => {
      anonymousMutationCompletion = result.current.mutation.mutateAsync();
    });

    expect(counts).toEqual({ mounts: 1, unmounts: 0 });

    await act(async () => {
      await result.current.session.login(credentialsB);
    });

    expectAuthenticatedAs(result.current.session.state, viewerB);
    expect(counts).toEqual({ mounts: 2, unmounts: 1 });
    const clientB = result.current.queryClient;
    expect(clientB).not.toBe(anonymousClient);
    expect(queryClients.generations.map(({ scope }) => scope)).toEqual([
      { epoch: 4, subject: null },
      { epoch: 5, subject: toSessionSubject(viewerB) },
    ]);
    expect(clientB.getQueryData(cachedKey)).toBeUndefined();
    const sessionMetaB = {
      session: {
        epoch: 5,
        subject: toSessionSubject(viewerB),
      },
    };
    expect(clientB.getDefaultOptions().queries?.meta).toEqual(sessionMetaB);
    expect(clientB.getDefaultOptions().mutations?.meta).toEqual(sessionMetaB);
    clientB.setQueryData(queryKey, "B query data");
    clientB.setQueryData(mutationKey, "B mutation data");

    await act(async () => {
      anonymousQuery.resolve("late anonymous query");
      anonymousMutation.resolve("late anonymous mutation");
      await Promise.all([
        anonymousQueryCompletion,
        anonymousMutationCompletion,
      ]);
    });

    expect(clientB.getQueryData(queryKey)).toBe("B query data");
    expect(clientB.getQueryData(mutationKey)).toBe("B mutation data");
  });

  it("coalesces duplicate logout calls into the exact same request promise", async () => {
    const authPort = createAuthPort();
    const serverLogout = deferred<void>();
    authPort.logout.mockReturnValueOnce(serverLogout.promise);
    const { result } = renderSession({
      authPort,
      initialState: authenticatedState(viewerA),
    });

    let firstLogout!: Promise<void>;
    let duplicateLogout!: Promise<void>;
    act(() => {
      firstLogout = result.current.session.logout();
      duplicateLogout = result.current.session.logout();
    });

    expect(duplicateLogout).toBe(firstLogout);
    await waitFor(() => expect(authPort.logout).toHaveBeenCalledTimes(1));
    expect(result.current.session.state).toMatchObject({
      status: "anonymous",
      reason: "logout",
      revocation: "unverified",
    });

    await act(async () => {
      serverLogout.resolve();
      await Promise.all([firstLogout, duplicateLogout]);
    });

    expect(authPort.logout).toHaveBeenCalledTimes(1);
    expect(result.current.session.state).toMatchObject({
      status: "anonymous",
      reason: "logout",
      revocation: "verified",
    });
  });

  it("treats a logout 401/M004 as verified server revocation without a notice", async () => {
    const authPort = createAuthPort();
    authPort.logout.mockRejectedValueOnce(authenticationError());
    const { result } = renderSession({
      authPort,
      initialState: authenticatedState(viewerA),
    });

    await act(async () => {
      await result.current.session.logout();
    });

    expect(authPort.logout).toHaveBeenCalledTimes(1);
    expect(result.current.session.state).toMatchObject({
      status: "anonymous",
      reason: "logout",
      revocation: "verified",
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("replaces the logout quarantine after server settlement", async () => {
    const authPort = createAuthPort();
    const serverLogout = deferred<void>();
    authPort.logout.mockReturnValueOnce(serverLogout.promise);
    const queryClients = createTrackedQueryClients();
    const { result } = renderSession({
      authPort,
      initialState: authenticatedState(viewerA),
      queryClientFactory: queryClients.factory,
    });
    const serverAKey = ["session-test", "pending-server-a"] as const;

    let logoutOperation!: Promise<void>;
    act(() => {
      logoutOperation = result.current.session.logout();
    });
    await waitFor(() => expect(authPort.logout).toHaveBeenCalledTimes(1));
    expect(queryClients.generations).toHaveLength(2);
    const quarantine = result.current.queryClient;
    expect(quarantine).toBe(queryClients.generations[1].client);

    await quarantine.fetchQuery({
      queryKey: serverAKey,
      queryFn: async () => "server A data",
    });
    expect(quarantine.getQueryData(serverAKey)).toBe("server A data");

    await act(async () => {
      serverLogout.resolve();
      await logoutOperation;
    });

    expect(queryClients.generations.map(({ scope }) => scope)).toEqual([
      { epoch: 4, subject: toSessionSubject(viewerA) },
      { epoch: 5, subject: null },
      { epoch: 5, subject: null },
    ]);
    const settledClient = result.current.queryClient;
    expect(settledClient).toBe(queryClients.generations[2].client);
    expect(settledClient).not.toBe(quarantine);
    expect(settledClient.getQueryData(serverAKey)).toBeUndefined();
    expect(queryClients.generations[1].clear).toHaveBeenCalledTimes(1);
    expect(result.current.session.state).toMatchObject({
      status: "anonymous",
      reason: "logout",
      revocation: "verified",
    });
  });

  it("publishes local anonymous before a successful server logout and keeps cookies untouched", async () => {
    const authPort = createAuthPort();
    const serverLogout = deferred<void>();
    authPort.logout.mockReturnValueOnce(serverLogout.promise);
    const { result } = renderSession({
      authPort,
      initialState: authenticatedState(viewerA),
    });
    document.cookie = "SESSION_ID=session-a; path=/";
    const cookieBeforeLogout = document.cookie;

    let logoutOperation!: Promise<void>;
    act(() => {
      logoutOperation = result.current.session.logout();
    });

    await waitFor(() => expect(authPort.logout).toHaveBeenCalledTimes(1));
    expect(result.current.session.state).toMatchObject({
      status: "anonymous",
      reason: "logout",
      revocation: "unverified",
      epoch: 5,
    });
    expect(document.cookie).toBe(cookieBeforeLogout);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => {
      serverLogout.resolve();
      await logoutOperation;
    });

    expect(result.current.session.state).toMatchObject({
      status: "anonymous",
      reason: "logout",
      revocation: "verified",
    });
    expect(document.cookie).toBe(cookieBeforeLogout);
  });

  it("keeps local anonymous after failed logout, shows a notice, and verifies on retry without mutating cookies", async () => {
    const authPort = createAuthPort();
    const failure = serverError("logout failed");
    authPort.logout
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const { result } = renderSession({
      authPort,
      initialState: authenticatedState(viewerA),
    });
    document.cookie = "SESSION_ID=session-a; path=/";
    const cookieBeforeLogout = document.cookie;

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.session.logout();
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBe(failure);
    expect(result.current.session.state).toMatchObject({
      status: "anonymous",
      reason: "logout",
      revocation: "unverified",
      revocationError: { kind: "server", retryable: true },
    });
    expect(document.cookie).toBe(cookieBeforeLogout);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "서버에서 로그아웃을 확인하지 못했습니다.",
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() =>
      expect(result.current.session.state).toMatchObject({
        status: "anonymous",
        reason: "logout",
        revocation: "verified",
      }),
    );
    expect(authPort.logout).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.cookie).toBe(cookieBeforeLogout);
  });

  it("lets the active login terminal probe cover an unrelated auth error", async () => {
    const authPort = createAuthPort();
    const loginRequest = deferred<void>();
    authPort.login.mockReturnValueOnce(loginRequest.promise);
    authPort.getViewer.mockRejectedValueOnce(authenticationError());
    const queryClients = createTrackedQueryClients();
    const { result } = renderSession({
      authPort,
      initialState: anonymousState(),
      queryClientFactory: queryClients.factory,
    });

    let loginOperation!: Promise<void>;
    act(() => {
      loginOperation = result.current.session.login(credentialsB);
    });
    const observedLogin = loginOperation.catch((error: unknown) => error);
    await waitFor(() => expect(authPort.login).toHaveBeenCalledTimes(1));
    const loginQuarantine = result.current.queryClient;

    act(() => {
      // Models a 401/M004 from an unrelated protected API, not authApi itself.
      triggerAuthError();
    });

    await act(flushMicrotasks);
    expect(result.current.queryClient).toBe(loginQuarantine);
    expect(authPort.getViewer).not.toHaveBeenCalled();
    expect(authPort.login).toHaveBeenCalledTimes(1);

    let loginResult: unknown;
    await act(async () => {
      loginRequest.resolve();
      loginResult = await observedLogin;
    });
    expect(loginResult).toMatchObject({
      status: 401,
      code: "M004",
    });

    expect(result.current.session.state).toMatchObject({
      status: "anonymous",
      reason: "server-revoked",
      revocation: "verified",
      epoch: 5,
    });
    expect(authPort.getViewer).toHaveBeenCalledTimes(1);
    expect(queryClients.generations.map(({ scope }) => scope)).toEqual([
      { epoch: 4, subject: null },
    ]);
    expect(result.current.queryClient.getDefaultOptions().queries?.meta).toEqual({
      session: { epoch: 5, subject: null },
    });
  });

  it("replays the latest remote phase after a pending login reaches its terminal viewer", async () => {
    const authPort = createAuthPort();
    const loginRequest = deferred<void>();
    authPort.login.mockReturnValueOnce(loginRequest.promise);
    authPort.getViewer.mockResolvedValue(viewerB);
    const broadcast = new FakeSessionBroadcast();
    const { result } = renderSession({
      authPort,
      broadcastFactory: () => broadcast,
      initialState: anonymousState(),
    });

    let loginOperation!: Promise<void>;
    act(() => {
      loginOperation = result.current.session.login(credentialsB);
    });
    await waitFor(() => expect(authPort.login).toHaveBeenCalledTimes(1));
    const loginQuarantine = result.current.queryClient;

    act(() => {
      broadcast.emit("invalidate");
      broadcast.emit("revalidate");
    });
    await act(flushMicrotasks);

    expect(authPort.getViewer).not.toHaveBeenCalled();
    expect(result.current.queryClient).toBe(loginQuarantine);

    await act(async () => {
      loginRequest.resolve();
      await loginOperation;
    });

    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expectAuthenticatedAs(result.current.session.state, viewerB),
    );
    expect(broadcast.published).toEqual(["invalidate", "revalidate"]);
  });

  it("replays remote verification only after a pending logout settles", async () => {
    const authPort = createAuthPort();
    const logoutRequest = deferred<void>();
    authPort.logout.mockReturnValueOnce(logoutRequest.promise);
    authPort.getViewer.mockRejectedValueOnce(authenticationError());
    const broadcast = new FakeSessionBroadcast();
    const { result } = renderSession({
      authPort,
      broadcastFactory: () => broadcast,
      initialState: authenticatedState(viewerA),
    });

    let logoutOperation!: Promise<void>;
    act(() => {
      logoutOperation = result.current.session.logout();
    });
    await waitFor(() => expect(authPort.logout).toHaveBeenCalledTimes(1));

    act(() => {
      broadcast.emit("invalidate");
      broadcast.emit("revalidate");
    });
    await act(flushMicrotasks);

    expect(authPort.getViewer).not.toHaveBeenCalled();
    expect(result.current.session.state).toMatchObject({
      status: "anonymous",
      reason: "logout",
      revocation: "unverified",
    });

    await act(async () => {
      logoutRequest.resolve();
      await logoutOperation;
    });

    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(result.current.session.state).toMatchObject({
        status: "anonymous",
        reason: "server-revoked",
        revocation: "verified",
      }),
    );
    expect(broadcast.published).toEqual(["invalidate", "revalidate"]);
  });

  it("restarts a slow external probe when a newer remote transition arrives", async () => {
    const authPort = createAuthPort();
    const staleProbe = deferred<SessionViewer>();
    const freshProbe = deferred<SessionViewer>();
    authPort.getViewer
      .mockReturnValueOnce(staleProbe.promise)
      .mockReturnValueOnce(freshProbe.promise);
    const broadcast = new FakeSessionBroadcast();
    const clearIdentityOwnedState = jest.fn();
    const { result } = renderSession({
      authPort,
      broadcastFactory: () => broadcast,
      clearIdentityOwnedState,
      initialState: authenticatedState(viewerA),
    });

    act(() => {
      broadcast.emit("revalidate");
    });
    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(1));
    const staleSignal = authPort.getViewer.mock.calls[0][0];

    act(() => {
      broadcast.emit("invalidate");
      broadcast.emit("revalidate");
    });
    expect(staleSignal?.aborted).toBe(true);

    await act(async () => {
      staleProbe.resolve(viewerB);
      await staleProbe.promise;
    });
    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(2));
    expect(result.current.session.state).toMatchObject({
      status: "checking",
      reason: "external-change",
    });

    await act(async () => {
      freshProbe.resolve(viewerC);
      await freshProbe.promise;
    });

    await waitFor(() =>
      expectAuthenticatedAs(result.current.session.state, viewerC),
    );
    expect(authPort.getViewer).toHaveBeenCalledTimes(2);
    expect(clearIdentityOwnedState).toHaveBeenCalledTimes(2);
  });

  it("restarts a slow external probe after a newer unrelated auth error", async () => {
    const authPort = createAuthPort();
    const staleProbe = deferred<SessionViewer>();
    const freshProbe = deferred<SessionViewer>();
    authPort.getViewer
      .mockReturnValueOnce(staleProbe.promise)
      .mockReturnValueOnce(freshProbe.promise);
    const broadcast = new FakeSessionBroadcast();
    const { result } = renderSession({
      authPort,
      broadcastFactory: () => broadcast,
      initialState: authenticatedState(viewerA),
    });

    act(() => {
      triggerAuthError();
    });
    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(1));
    const staleSignal = authPort.getViewer.mock.calls[0][0];

    act(() => {
      triggerAuthError();
    });
    expect(staleSignal?.aborted).toBe(true);

    await act(async () => {
      staleProbe.resolve(viewerB);
      await staleProbe.promise;
    });
    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(2));
    expect(result.current.session.state).toMatchObject({
      status: "checking",
      reason: "external-change",
    });

    await act(async () => {
      freshProbe.resolve(viewerC);
      await freshProbe.promise;
    });

    await waitFor(() =>
      expectAuthenticatedAs(result.current.session.state, viewerC),
    );
    expect(authPort.getViewer).toHaveBeenCalledTimes(2);
    expect(broadcast.published).toEqual(["invalidate", "revalidate"]);
  });

  it("coalesces duplicate auth error events into one invalidation and viewer probe", async () => {
    const authPort = createAuthPort();
    authPort.getViewer.mockResolvedValue(viewerAUpdated);
    const queryClients = createTrackedQueryClients();
    const cleanupGate = deferred<void>();
    const broadcast = new FakeSessionBroadcast();
    const { result } = renderSession({
      authPort,
      broadcastFactory: () => broadcast,
      initialState: authenticatedState(viewerA),
      queryClientFactory: queryClients.factory,
    });
    queryClients.generations[0].cancelQueries.mockImplementation(
      () => cleanupGate.promise,
    );

    act(() => {
      triggerAuthError();
      triggerAuthError();
    });
    expect(queryClients.generations[0].cancelQueries).toHaveBeenCalledTimes(1);

    await act(async () => {
      cleanupGate.resolve();
      await cleanupGate.promise;
    });
    await waitFor(() =>
      expect(result.current.session.state.status).toBe("authenticated"),
    );

    expect(authPort.getViewer).toHaveBeenCalledTimes(1);
    expect(broadcast.published).toEqual(["invalidate", "revalidate"]);
  });

  it("marks a captured A scope stale after logout and a later B login", async () => {
    const authPort = createAuthPort();
    authPort.logout.mockResolvedValueOnce(undefined);
    authPort.login.mockResolvedValueOnce(undefined);
    authPort.getViewer.mockResolvedValueOnce(viewerB);
    const { result } = renderSession({
      authPort,
      initialState: authenticatedState(viewerA),
    });
    const capturedA = result.current.session.captureAuthenticatedSession();
    expect(capturedA).not.toBeNull();
    if (capturedA === null) throw new Error("expected authenticated scope");
    expect(result.current.session.isCurrentSession(capturedA)).toBe(true);

    await act(async () => {
      await result.current.session.logout();
    });
    expect(result.current.session.isCurrentSession(capturedA)).toBe(false);

    await act(async () => {
      await result.current.session.login(credentialsB);
    });

    expectAuthenticatedAs(result.current.session.state, viewerB);
    expect(result.current.session.isCurrentSession(capturedA)).toBe(false);
    const capturedB = result.current.session.captureAuthenticatedSession();
    expect(capturedB).not.toBeNull();
    if (capturedB === null) throw new Error("expected authenticated scope");
    expect(result.current.session.isCurrentSession(capturedB)).toBe(true);
    expect(capturedB.epoch).toBeGreaterThan(capturedA.epoch);
  });

  it("isolates detached old query and mutation completions from the B QueryClient", async () => {
    const authPort = createAuthPort();
    authPort.getViewer.mockResolvedValueOnce(viewerB);
    const queryClients = createTrackedQueryClients();
    const oldQuery = deferred<string>();
    const oldMutation = deferred<string>();
    const counts: ChildLifecycleCounts = { mounts: 0, unmounts: 0 };
    const ProviderWrapper = createWrapper({
      authPort,
      initialState: authenticatedState(viewerA),
      queryClientFactory: queryClients.factory,
    });
    const Wrapper = ({ children }: { readonly children: ReactNode }) => (
      <ProviderWrapper>
        <ChildLifecycleProbe counts={counts} />
        {children}
      </ProviderWrapper>
    );
    const oldQueryKey = ["session-test", "old-query"] as const;
    const sharedMutationKey = ["session-test", "mutation-owner"] as const;

    const { result } = renderHook(() => {
      const session = useSession();
      const queryClient = useQueryClient();
      const mutation = useMutation<string, Error, void>({
        mutationFn: () => oldMutation.promise,
        onSuccess: (value) => {
          queryClient.setQueryData(sharedMutationKey, value);
        },
      });

      return { session, queryClient, mutation };
    }, { wrapper: Wrapper });
    const clientA = result.current.queryClient;
    const oldQueryCompletion = clientA
      .fetchQuery({
        queryKey: oldQueryKey,
        queryFn: () => oldQuery.promise,
      })
      .catch(() => undefined);
    let oldMutationCompletion!: Promise<string>;
    act(() => {
      oldMutationCompletion = result.current.mutation.mutateAsync();
    });
    expect(counts).toEqual({ mounts: 1, unmounts: 0 });

    await act(async () => {
      await result.current.session.revalidate();
    });
    expectAuthenticatedAs(result.current.session.state, viewerB);
    expect(counts).toEqual({ mounts: 2, unmounts: 1 });
    const clientB = result.current.queryClient;
    expect(clientB).not.toBe(clientA);
    clientB.setQueryData(sharedMutationKey, "B-owned");
    clientB.setQueryData(oldQueryKey, "B-query");

    await act(async () => {
      oldQuery.resolve("late A query");
      oldMutation.resolve("late A mutation");
      await Promise.all([oldQueryCompletion, oldMutationCompletion]);
    });

    expect(result.current.queryClient).toBe(clientB);
    expect(clientB.getQueryData(sharedMutationKey)).toBe("B-owned");
    expect(clientB.getQueryData(oldQueryKey)).toBe("B-query");
    expect(counts).toEqual({ mounts: 2, unmounts: 1 });
  });

  it("quarantines public work started between remote invalidate and B revalidation", async () => {
    const authPort = createAuthPort();
    authPort.getViewer.mockResolvedValueOnce(viewerB);
    const broadcast = new FakeSessionBroadcast();
    const queryClients = createTrackedQueryClients();
    const interimQuery = deferred<string>();
    const interimMutation = deferred<string>();
    const Wrapper = createWrapper({
      authPort,
      broadcastFactory: () => broadcast,
      initialState: authenticatedState(viewerA),
      queryClientFactory: queryClients.factory,
    });
    const queryKey = ["session-test", "interim-public-query"] as const;
    const mutationKey = ["session-test", "interim-public-mutation"] as const;
    const { result } = renderHook(() => {
      const session = useSession();
      const queryClient = useQueryClient();
      const mutation = useMutation<string, Error, void>({
        mutationFn: () => interimMutation.promise,
        onSuccess: (value) => {
          queryClient.setQueryData(mutationKey, value);
        },
      });

      return { mutation, queryClient, session };
    }, { wrapper: Wrapper });
    const clientA = result.current.queryClient;

    act(() => {
      broadcast.emit("invalidate");
    });
    await waitFor(() => expect(queryClients.generations).toHaveLength(2));
    await waitFor(() =>
      expect(result.current.session.state).toMatchObject({
        status: "checking",
        reason: "external-change",
      }),
    );
    const interimClient = result.current.queryClient;
    expect(interimClient).not.toBe(clientA);
    expect(interimClient).toBe(queryClients.generations[1].client);
    expect(queryClients.generations[1].scope).toEqual({
      epoch: 5,
      subject: null,
    });

    const interimQueryCompletion = interimClient
      .fetchQuery({
        queryKey,
        queryFn: () => interimQuery.promise,
      })
      .catch(() => undefined);
    let interimMutationCompletion!: Promise<string>;
    act(() => {
      interimMutationCompletion = result.current.mutation.mutateAsync();
    });
    expect(interimClient.getMutationCache().getAll()).toHaveLength(1);

    act(() => {
      broadcast.emit("revalidate");
    });
    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expectAuthenticatedAs(result.current.session.state, viewerB),
    );
    const clientB = result.current.queryClient;
    expect(clientB).toBe(queryClients.generations[2].client);
    expect(queryClients.generations.map(({ scope }) => scope)).toEqual([
      { epoch: 4, subject: toSessionSubject(viewerA) },
      { epoch: 5, subject: null },
      { epoch: 5, subject: toSessionSubject(viewerB) },
    ]);
    clientB.setQueryData(queryKey, "B query data");
    clientB.setQueryData(mutationKey, "B mutation data");

    await act(async () => {
      interimQuery.resolve("late interim query");
      interimMutation.resolve("late interim mutation");
      await Promise.all([
        interimQueryCompletion,
        interimMutationCompletion,
      ]);
    });

    expect(result.current.queryClient).toBe(clientB);
    expect(clientB.getQueryData(queryKey)).toBe("B query data");
    expect(clientB.getQueryData(mutationKey)).toBe("B mutation data");
  });

  it.each([
    ["anonymous", anonymousState()],
    ["error", retryableErrorState()],
  ] as const)("rechecks a %s session when the window regains focus", async (
    _name,
    initialState,
  ) => {
    const authPort = createAuthPort();
    authPort.getViewer.mockResolvedValueOnce(viewerA);
    const { result } = renderSession({ authPort, initialState });

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expectAuthenticatedAs(result.current.session.state, viewerA),
    );
  });

  it("does not start a focus probe during an active login", async () => {
    const authPort = createAuthPort();
    const loginRequest = deferred<void>();
    authPort.login.mockReturnValueOnce(loginRequest.promise);
    authPort.getViewer.mockResolvedValueOnce(viewerB);
    const { result } = renderSession({
      authPort,
      initialState: anonymousState(),
    });

    let loginOperation!: Promise<void>;
    act(() => {
      loginOperation = result.current.session.login(credentialsB);
    });
    await waitFor(() => expect(authPort.login).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await act(flushMicrotasks);
    expect(authPort.getViewer).not.toHaveBeenCalled();

    await act(async () => {
      loginRequest.resolve();
      await loginOperation;
    });
    expect(authPort.getViewer).toHaveBeenCalledTimes(1);
    expectAuthenticatedAs(result.current.session.state, viewerB);
  });

  it("does not start a focus probe during an active logout", async () => {
    const authPort = createAuthPort();
    const logoutRequest = deferred<void>();
    authPort.logout.mockReturnValueOnce(logoutRequest.promise);
    const { result } = renderSession({
      authPort,
      initialState: authenticatedState(viewerA),
    });

    let logoutOperation!: Promise<void>;
    act(() => {
      logoutOperation = result.current.session.logout();
    });
    await waitFor(() => expect(authPort.logout).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await act(flushMicrotasks);
    expect(authPort.getViewer).not.toHaveBeenCalled();

    await act(async () => {
      logoutRequest.resolve();
      await logoutOperation;
    });
    expect(authPort.getViewer).not.toHaveBeenCalled();
  });

  it("does not recheck an unverified local logout on focus", async () => {
    const authPort = createAuthPort();
    const initialState: SessionState = {
      status: "anonymous",
      reason: "logout",
      revocation: "unverified",
      revocationError: new AppError({
        kind: "network",
        code: "LOGOUT_UNVERIFIED",
        message: "Logout could not be verified.",
        retryable: true,
      }),
      operationId: 7,
      epoch: 5,
    };
    const { result } = renderSession({ authPort, initialState });

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await act(flushMicrotasks);

    expect(authPort.getViewer).not.toHaveBeenCalled();
    expect(result.current.session.state).toBe(initialState);
  });

  describe("remote invalidate recovery timer", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    it("waits 1500ms and the cleanup gate before probing", async () => {
      const authPort = createAuthPort();
      authPort.getViewer.mockResolvedValueOnce(viewerAUpdated);
      const queryClients = createTrackedQueryClients();
      const cleanupGate = deferred<void>();
      const broadcast = new FakeSessionBroadcast();
      const { result } = renderSession({
        authPort,
        broadcastFactory: () => broadcast,
        initialState: authenticatedState(viewerA),
        queryClientFactory: queryClients.factory,
      });
      queryClients.generations[0].cancelQueries.mockImplementation(
        () => cleanupGate.promise,
      );

      act(() => {
        broadcast.emit("invalidate");
      });
      expect(authPort.getViewer).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(1_499);
        await flushMicrotasks();
      });
      expect(authPort.getViewer).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(1);
        await flushMicrotasks();
      });
      expect(authPort.getViewer).not.toHaveBeenCalled();

      await act(async () => {
        cleanupGate.resolve();
        await cleanupGate.promise;
        await flushMicrotasks();
      });

      expect(authPort.getViewer).toHaveBeenCalledTimes(1);
      expectAuthenticatedAs(result.current.session.state, viewerAUpdated);
    });

    it("cancels recovery when revalidate arrives first", async () => {
      const authPort = createAuthPort();
      authPort.getViewer.mockResolvedValueOnce(viewerAUpdated);
      const broadcast = new FakeSessionBroadcast();
      const { result } = renderSession({
        authPort,
        broadcastFactory: () => broadcast,
        initialState: authenticatedState(viewerA),
      });

      act(() => {
        broadcast.emit("invalidate");
        broadcast.emit("revalidate");
      });
      await act(flushMicrotasks);

      expect(authPort.getViewer).toHaveBeenCalledTimes(1);
      expectAuthenticatedAs(result.current.session.state, viewerAUpdated);

      await act(async () => {
        jest.advanceTimersByTime(1_500);
        await flushMicrotasks();
      });
      expect(authPort.getViewer).toHaveBeenCalledTimes(1);
    });

    it("coalesces duplicate invalidates into one cleanup, timer, and probe", async () => {
      const authPort = createAuthPort();
      authPort.getViewer.mockResolvedValueOnce(viewerAUpdated);
      const queryClients = createTrackedQueryClients();
      const cleanupGate = deferred<void>();
      const clearIdentityOwnedState = jest.fn();
      const broadcast = new FakeSessionBroadcast();
      const { result } = renderSession({
        authPort,
        broadcastFactory: () => broadcast,
        clearIdentityOwnedState,
        initialState: authenticatedState(viewerA),
        queryClientFactory: queryClients.factory,
      });
      queryClients.generations[0].cancelQueries.mockImplementation(
        () => cleanupGate.promise,
      );
      const setTimeoutSpy = jest.spyOn(window, "setTimeout");

      act(() => {
        broadcast.emit("invalidate");
        broadcast.emit("invalidate");
      });

      expect(clearIdentityOwnedState).toHaveBeenCalledTimes(1);
      expect(queryClients.generations[0].cancelQueries).toHaveBeenCalledTimes(1);
      expect(
        setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 1_500),
      ).toHaveLength(1);

      await act(async () => {
        jest.advanceTimersByTime(1_500);
        await flushMicrotasks();
      });
      expect(authPort.getViewer).not.toHaveBeenCalled();

      await act(async () => {
        cleanupGate.resolve();
        await cleanupGate.promise;
        await flushMicrotasks();
      });

      expect(authPort.getViewer).toHaveBeenCalledTimes(1);
      expectAuthenticatedAs(result.current.session.state, viewerAUpdated);
      await act(async () => {
        jest.advanceTimersByTime(1_500);
        await flushMicrotasks();
      });
      expect(authPort.getViewer).toHaveBeenCalledTimes(1);
    });

    it("does not probe after unmount", async () => {
      const authPort = createAuthPort();
      authPort.getViewer.mockResolvedValueOnce(viewerAUpdated);
      const broadcast = new FakeSessionBroadcast();
      const { unmount } = renderSession({
        authPort,
        broadcastFactory: () => broadcast,
        initialState: authenticatedState(viewerA),
      });
      const setTimeoutSpy = jest.spyOn(window, "setTimeout");
      const clearTimeoutSpy = jest.spyOn(window, "clearTimeout");

      act(() => {
        broadcast.emit("invalidate");
      });
      const recoveryTimerResults = setTimeoutSpy.mock.calls
        .map(([, delay], index) => ({
          delay,
          timerId: setTimeoutSpy.mock.results[index].value,
        }))
        .filter(({ delay }) => delay === 1_500);
      expect(recoveryTimerResults).toHaveLength(1);

      unmount();
      await act(flushMicrotasks);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(
        recoveryTimerResults[0].timerId,
      );

      await act(async () => {
        jest.advanceTimersByTime(1_500);
        await flushMicrotasks();
      });
      expect(authPort.getViewer).not.toHaveBeenCalled();
    });
  });

  it("handles injected invalidate/revalidate phases without rebroadcasting them", async () => {
    const authPort = createAuthPort();
    const viewerProbe = deferred<SessionViewer>();
    authPort.getViewer.mockReturnValueOnce(viewerProbe.promise);
    const broadcast = new FakeSessionBroadcast();
    const { result } = renderSession({
      authPort,
      broadcastFactory: () => broadcast,
      initialState: authenticatedState(viewerA),
    });

    act(() => {
      broadcast.emit("invalidate");
    });
    await waitFor(() =>
      expect(result.current.session.state).toMatchObject({
        status: "checking",
        reason: "external-change",
      }),
    );
    expect(authPort.getViewer).not.toHaveBeenCalled();

    act(() => {
      broadcast.emit("revalidate");
    });
    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(1));
    expect(broadcast.publish).not.toHaveBeenCalled();

    await act(async () => {
      viewerProbe.resolve(viewerAUpdated);
      await viewerProbe.promise;
    });
    await waitFor(() =>
      expectAuthenticatedAs(result.current.session.state, viewerAUpdated),
    );
    expect(broadcast.publish).not.toHaveBeenCalled();
  });

  it("closes and recreates injected broadcast ownership safely in StrictMode", async () => {
    const authPort = createAuthPort();
    authPort.getViewer.mockResolvedValueOnce(viewerAUpdated);
    const broadcasts: FakeSessionBroadcast[] = [];
    const broadcastFactory = jest.fn(() => {
      const broadcast = new FakeSessionBroadcast();
      broadcasts.push(broadcast);
      return broadcast;
    });
    const Wrapper = createWrapper({
      authPort,
      broadcastFactory,
      initialState: authenticatedState(viewerA),
    });
    const { result, unmount } = renderHook(
      () => ({ session: useSession(), queryClient: useQueryClient() }),
      { wrapper: Wrapper, reactStrictMode: true },
    );

    await waitFor(() => expect(broadcastFactory).toHaveBeenCalledTimes(2));
    expect(broadcasts[0].close).toHaveBeenCalledTimes(1);
    expect(broadcasts[1].close).not.toHaveBeenCalled();

    act(() => {
      broadcasts[1].emit("revalidate");
    });
    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expectAuthenticatedAs(result.current.session.state, viewerAUpdated),
    );

    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(broadcasts[1].close).toHaveBeenCalledTimes(1);
  });
});
