import { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { SessionState, SessionViewer } from "./sessionState";
import { toSessionSubject } from "./sessionState";
import {
  type SessionQueryClientFactory,
  useSessionQueryLifetime,
} from "./useSessionQueryLifetime";

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

const deferred = <T,>(): Deferred<T> => {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
};

const viewerA: SessionViewer = {
  id: 1,
  email: "user-a@example.com",
  nickname: "User A",
  thumbnailImageUrl: null,
};

const authenticatedState = (epoch = 4): SessionState => ({
  status: "authenticated",
  viewer: viewerA,
  subject: toSessionSubject(viewerA),
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

interface TrackedClient {
  readonly client: QueryClient;
  readonly cancelQueries: jest.SpyInstance;
  readonly clear: jest.SpyInstance;
}

const createTrackedFactory = () => {
  const clients: TrackedClient[] = [];
  const factory: SessionQueryClientFactory = jest.fn(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    clients.push({
      client,
      cancelQueries: jest.spyOn(client, "cancelQueries"),
      clear: jest.spyOn(client, "clear"),
    });
    return client;
  });

  return { clients, factory };
};

describe("useSessionQueryLifetime", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["authenticated", authenticatedState(7), toSessionSubject(viewerA)],
    ["anonymous", anonymousState(7), null],
  ] as const)("publishes %s initial scope metadata", (
    _name,
    initialState,
    subject,
  ) => {
    const { result } = renderHook(() =>
      useSessionQueryLifetime({ initialState }),
    );
    const expectedMeta = { session: { epoch: 7, subject } };

    expect(result.current.generation).toMatchObject({
      epoch: 7,
      fenceId: 0,
      owned: true,
      subject,
      tainted: false,
    });
    expect(
      result.current.generation.client.getDefaultOptions().queries?.meta,
    ).toEqual(expectedMeta);
    expect(
      result.current.generation.client.getDefaultOptions().mutations?.meta,
    ).toEqual(expectedMeta);
  });

  it("publishes the next fence before cancelling and clearing the previous generation once", async () => {
    const { clients, factory } = createTrackedFactory();
    const cancelGate = deferred<void>();
    const isStillCurrent = jest.fn(() => true);
    const { result } = renderHook(() =>
      useSessionQueryLifetime({
        initialState: authenticatedState(),
        queryClientFactory: factory,
      }),
    );
    clients[0].cancelQueries.mockReturnValueOnce(cancelGate.promise);

    let replacement!: Promise<boolean>;
    act(() => {
      replacement = result.current.replaceQueryGeneration({
        epoch: 5,
        subject: null,
        tainted: true,
        isStillCurrent,
      });
    });

    await waitFor(() => expect(clients).toHaveLength(2));
    await waitFor(() =>
      expect(result.current.generation).toMatchObject({
        client: clients[1].client,
        epoch: 5,
        fenceId: 1,
        owned: true,
        subject: null,
        tainted: true,
      }),
    );
    expect(clients[0].cancelQueries).toHaveBeenCalledTimes(1);
    expect(clients[0].clear).not.toHaveBeenCalled();
    expect(isStillCurrent).not.toHaveBeenCalled();

    let didRemainCurrent!: boolean;
    await act(async () => {
      cancelGate.resolve();
      didRemainCurrent = await replacement;
    });

    expect(didRemainCurrent).toBe(true);
    expect(clients[0].cancelQueries).toHaveBeenCalledTimes(1);
    expect(clients[0].clear).toHaveBeenCalledTimes(1);
    expect(clients[0].cancelQueries.mock.invocationCallOrder[0]).toBeLessThan(
      clients[0].clear.mock.invocationCallOrder[0],
    );
    expect(isStillCurrent).toHaveBeenCalledTimes(1);
  });

  it("clears after a cancellation rejection and returns the current-operation verdict", async () => {
    const { clients, factory } = createTrackedFactory();
    const cancellationFailure = new Error("cancel failed");
    const isStillCurrent = jest.fn(() => false);
    const { result } = renderHook(() =>
      useSessionQueryLifetime({
        initialState: authenticatedState(),
        queryClientFactory: factory,
      }),
    );
    clients[0].cancelQueries.mockRejectedValueOnce(cancellationFailure);

    let didRemainCurrent!: boolean;
    await act(async () => {
      didRemainCurrent = await result.current.replaceQueryGeneration({
        epoch: 5,
        subject: null,
        isStillCurrent,
      });
    });

    expect(didRemainCurrent).toBe(false);
    expect(clients[0].cancelQueries).toHaveBeenCalledTimes(1);
    expect(clients[0].clear).toHaveBeenCalledTimes(1);
    expect(clients[0].cancelQueries.mock.invocationCallOrder[0]).toBeLessThan(
      clients[0].clear.mock.invocationCallOrder[0],
    );
    expect(isStillCurrent).toHaveBeenCalledTimes(1);
    expect(result.current.generation).toMatchObject({
      client: clients[1].client,
      epoch: 5,
      fenceId: 1,
      subject: null,
    });
  });

  it("resets an anonymous generation in place before stabilizing it", async () => {
    const { clients, factory } = createTrackedFactory();
    const cancelGate = deferred<void>();
    const isStillCurrent = jest.fn(() => true);
    const { result } = renderHook(() =>
      useSessionQueryLifetime({
        initialState: anonymousState(),
        queryClientFactory: factory,
      }),
    );
    const initialClient = result.current.generation.client;
    clients[0].cancelQueries.mockReturnValueOnce(cancelGate.promise);
    initialClient.setQueryData(["stale"], "anonymous data");

    let reset!: Promise<boolean>;
    act(() => {
      reset = result.current.resetQueryGeneration({
        epoch: 5,
        subject: null,
        isStillCurrent,
      });
    });

    await waitFor(() =>
      expect(result.current.generation).toMatchObject({
        client: initialClient,
        epoch: 5,
        fenceId: 0,
        subject: null,
        tainted: true,
      }),
    );
    expect(clients).toHaveLength(1);
    expect(clients[0].clear).not.toHaveBeenCalled();

    await act(async () => {
      cancelGate.resolve();
      await reset;
    });

    expect(initialClient.getQueryData(["stale"])).toBeUndefined();
    let didStabilize!: boolean;
    act(() => {
      didStabilize = result.current.stabilizeQueryGeneration({
        epoch: 5,
        subject: null,
        isStillCurrent,
      });
    });
    expect(didStabilize).toBe(true);
    expect(result.current.generation).toMatchObject({
      client: initialClient,
      fenceId: 0,
      tainted: false,
    });
    expect(initialClient.getDefaultOptions().queries?.meta).toEqual({
      session: { epoch: 5, subject: null },
    });
    expect(clients).toHaveLength(1);
    expect(clients[0].cancelQueries).toHaveBeenCalledTimes(1);
    expect(clients[0].clear).toHaveBeenCalledTimes(1);
  });

  it("does not let a superseded in-place reset clear newer generation data", async () => {
    const { clients, factory } = createTrackedFactory();
    const firstCancel = deferred<void>();
    const { result } = renderHook(() =>
      useSessionQueryLifetime({
        initialState: anonymousState(),
        queryClientFactory: factory,
      }),
    );
    const client = result.current.generation.client;
    clients[0].cancelQueries
      .mockReturnValueOnce(firstCancel.promise)
      .mockResolvedValueOnce(undefined);

    let staleReset!: Promise<boolean>;
    act(() => {
      staleReset = result.current.resetQueryGeneration({
        epoch: 5,
        subject: null,
        isStillCurrent: () => true,
      });
    });

    await act(async () => {
      await result.current.resetQueryGeneration({
        epoch: 6,
        subject: null,
        isStillCurrent: () => true,
      });
    });
    client.setQueryData(["new-generation"], "keep me");

    let didStaleResetRemainCurrent!: boolean;
    await act(async () => {
      firstCancel.resolve();
      didStaleResetRemainCurrent = await staleReset;
    });

    expect(didStaleResetRemainCurrent).toBe(false);
    expect(client.getQueryData(["new-generation"])).toBe("keep me");
    expect(result.current.generation).toMatchObject({
      client,
      epoch: 6,
      fenceId: 0,
      tainted: true,
    });
    expect(clients[0].clear).toHaveBeenCalledTimes(1);
  });

  it("does not dispose an injected initial client it does not own", async () => {
    const initialQueryClient = new QueryClient();
    const cancelQueries = jest.spyOn(initialQueryClient, "cancelQueries");
    const clear = jest.spyOn(initialQueryClient, "clear");
    const { result } = renderHook(() =>
      useSessionQueryLifetime({
        initialQueryClient,
        initialState: anonymousState(),
      }),
    );

    await act(async () => {
      await result.current.disposeCurrentGeneration();
    });

    expect(result.current.generation.owned).toBe(false);
    expect(cancelQueries).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it("applies the initial session scope to an injected client", () => {
    const initialQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { result } = renderHook(() =>
      useSessionQueryLifetime({
        initialQueryClient,
        initialState: authenticatedState(9),
      }),
    );
    const expectedMeta = {
      session: { epoch: 9, subject: toSessionSubject(viewerA) },
    };

    expect(result.current.generation.client).toBe(initialQueryClient);
    expect(initialQueryClient.getDefaultOptions().queries).toMatchObject({
      retry: false,
      meta: expectedMeta,
    });
    expect(initialQueryClient.getDefaultOptions().mutations).toMatchObject({
      retry: false,
      meta: expectedMeta,
    });
  });

  it("cancels and clears an owned current generation once", async () => {
    const { clients, factory } = createTrackedFactory();
    const { result } = renderHook(() =>
      useSessionQueryLifetime({
        initialState: anonymousState(),
        queryClientFactory: factory,
      }),
    );

    await act(async () => {
      await result.current.disposeCurrentGeneration();
    });

    expect(result.current.generation.owned).toBe(true);
    expect(clients[0].cancelQueries).toHaveBeenCalledTimes(1);
    expect(clients[0].clear).toHaveBeenCalledTimes(1);
    expect(clients[0].cancelQueries.mock.invocationCallOrder[0]).toBeLessThan(
      clients[0].clear.mock.invocationCallOrder[0],
    );
  });
});
