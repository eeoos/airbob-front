import type { Mocked } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import type {
  SessionAuthPort,
  SessionCredentials,
  SessionViewer,
} from "../../features/auth/ports/sessionPort";
import type { SessionBroadcast } from "../../platform/session/sessionBroadcast";
import {
  AuthIntentProvider,
  useAuthIntent,
} from "../../workflows/auth-intent";
import { SessionProvider } from "./SessionProvider";
import { toSessionSubject, type SessionState } from "./sessionState";
import { useSession } from "./useSession";

const viewerA: SessionViewer = {
  id: 1,
  email: "viewer-a@example.com",
  nickname: "Viewer A",
  thumbnailImageUrl: null,
};

const viewerB: SessionViewer = {
  id: 2,
  email: "viewer-b@example.com",
  nickname: "Viewer B",
  thumbnailImageUrl: null,
};

const initialState: SessionState = {
  status: "authenticated",
  viewer: viewerA,
  subject: toSessionSubject(viewerA),
  epoch: 4,
  revalidation: { status: "idle" },
};

const credentials: SessionCredentials = {
  email: viewerB.email,
  password: "password-b",
};

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

const createAuthPort = (): Mocked<SessionAuthPort> => ({
  getViewer: vi.fn<(signal?: AbortSignal) => Promise<SessionViewer>>(() =>
    Promise.resolve(viewerB),
  ),
  login: vi.fn<
    (credentials: SessionCredentials, signal?: AbortSignal) => Promise<void>
  >(() => Promise.resolve()),
  logout: vi.fn<(signal?: AbortSignal) => Promise<void>>(() =>
    Promise.resolve(),
  ),
});

const createBroadcast = (): SessionBroadcast => ({
  publish: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
  close: vi.fn(),
});

describe("SessionProvider stable boundary", () => {
  it("keeps the injected workflow provider mounted while Query generations remount", async () => {
    const authPort = createAuthPort();
    let stableBoundaryMounts = 0;
    let stableBoundaryUnmounts = 0;
    let querySubtreeMounts = 0;

    function StableBoundary({ children }: { readonly children: ReactNode }) {
      const session = useSession();

      useEffect(() => {
        stableBoundaryMounts += 1;
        return () => {
          stableBoundaryUnmounts += 1;
        };
      }, []);

      return (
        <AuthIntentProvider session={session}>{children}</AuthIntentProvider>
      );
    }

    function QuerySubtreeProbe() {
      const session = useSession();
      useAuthIntent();

      useEffect(() => {
        querySubtreeMounts += 1;
      }, []);

      return (
        <>
          <output data-testid="session-subject">
            {session.state.status === "authenticated"
              ? session.state.subject
              : session.state.status}
          </output>
          <button type="button" onClick={() => void session.login(credentials)}>
            Switch identity
          </button>
        </>
      );
    }

    render(
      <MemoryRouter>
        <SessionProvider
          authPort={authPort}
          broadcastFactory={createBroadcast}
          initialState={initialState}
          stableBoundary={StableBoundary}
        >
          <QuerySubtreeProbe />
        </SessionProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch identity" }));

    await waitFor(() =>
      expect(screen.getByTestId("session-subject")).toHaveTextContent(
        toSessionSubject(viewerB),
      ),
    );
    expect(stableBoundaryMounts).toBe(1);
    expect(stableBoundaryUnmounts).toBe(0);
    expect(querySubtreeMounts).toBeGreaterThan(1);
  });

  it("clears an anonymous pending intent as soon as explicit logout starts", async () => {
    const logoutTransport = deferred<void>();
    const authPort = createAuthPort();
    authPort.logout.mockReturnValue(logoutTransport.promise);
    const anonymousState: SessionState = {
      status: "anonymous",
      reason: "bootstrap",
      revocation: "verified",
      operationId: 0,
      epoch: 0,
    };

    function StableBoundary({ children }: { readonly children: ReactNode }) {
      const session = useSession();
      return (
        <AuthIntentProvider session={session}>{children}</AuthIntentProvider>
      );
    }

    function AnonymousProbe() {
      const session = useSession();
      const authIntent = useAuthIntent();

      return (
        <>
          <output data-testid="pending-intent">
            {authIntent.pending ? "pending" : "none"}
          </output>
          <output data-testid="logout-state">
            {session.state.status === "anonymous"
              ? `${session.state.reason}:${session.state.revocation}`
              : session.state.status}
          </output>
          <button
            type="button"
            onClick={() =>
              authIntent.request({
                type: "wishlist.open",
                accommodationId: 7,
              })
            }
          >
            Remember intent
          </button>
          <button type="button" onClick={() => void session.logout()}>
            Log out
          </button>
        </>
      );
    }

    render(
      <MemoryRouter>
        <SessionProvider
          authPort={authPort}
          broadcastFactory={createBroadcast}
          initialState={anonymousState}
          stableBoundary={StableBoundary}
        >
          <AnonymousProbe />
        </SessionProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remember intent" }));
    expect(screen.getByTestId("pending-intent")).toHaveTextContent("pending");

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() =>
      expect(screen.getByTestId("pending-intent")).toHaveTextContent("none"),
    );
    expect(screen.getByTestId("logout-state")).toHaveTextContent(
      "logout:unverified",
    );
    await waitFor(() => expect(authPort.logout).toHaveBeenCalledTimes(1));

    await act(async () => {
      logoutTransport.resolve();
      await logoutTransport.promise;
    });
    await waitFor(() =>
      expect(screen.getByTestId("logout-state")).toHaveTextContent(
        "logout:verified",
      ),
    );
    expect(screen.getByTestId("pending-intent")).toHaveTextContent("none");
  });
});
