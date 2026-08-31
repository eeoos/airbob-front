import type { Mocked } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { authApi } from "../../features/auth/api/authApi";
import { useAuthCommands } from "../../features/auth/ports/AuthCommandProvider";
import { Dialog, ToastHost } from "../../shared/ui";
import {
  SessionProvider,
  type SessionContextValue,
} from "../session/SessionProvider";
import { toSessionSubject } from "../session/sessionState";
import { useSession } from "../session/useSession";
import { AppProviders } from "./AppProviders";
import { AuthIntentStableBoundary } from "./AuthIntentStableBoundary";

const APP_OVERLAY_ROOT_ID = "airbob-portal-root";

vi.mock("../session/useSession", () => ({
  useSession: vi.fn(),
}));

vi.mock("../../features/auth/api/authApi", () => ({
  authApi: { signup: vi.fn() },
}));

vi.mock("../session/SessionProvider", () => ({
  SessionProvider: vi.fn(
    ({
      children,
      stableBoundary: StableBoundary,
    }: {
      readonly children: ReactNode;
      readonly stableBoundary?: ComponentType<{
        readonly children: ReactNode;
      }>;
    }) =>
      StableBoundary ? (
        <StableBoundary>{children}</StableBoundary>
      ) : (
        <>{children}</>
      ),
  ),
}));

const mockUseSession = vi.mocked(useSession);

const createAnonymousSession = (): Mocked<SessionContextValue> =>
  ({
    state: {
      status: "anonymous",
      reason: "bootstrap",
      revocation: "verified",
      operationId: 0,
      epoch: 0,
    },
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    revalidate: vi.fn().mockResolvedValue(undefined),
    retryServerLogout: vi.fn().mockResolvedValue(undefined),
    captureAuthenticatedSession: vi.fn().mockReturnValue(null),
    isCurrentSession: vi.fn().mockReturnValue(false),
  }) as Mocked<SessionContextValue>;

describe("AppProviders", () => {
  beforeEach(() => {
    vi.mocked(SessionProvider).mockClear();
    mockUseSession.mockReset();
    mockUseSession.mockReturnValue(createAnonymousSession());
    vi.mocked(authApi.signup).mockReset().mockResolvedValue(undefined);
  });

  it("passes generic and revoked identity cleanup ports to the session owner", () => {
    const clearIdentityOwnedState = vi.fn();
    const clearRevokedIdentityOwnedState = vi.fn();

    render(
      <MemoryRouter>
        <AppProviders
          clearIdentityOwnedState={clearIdentityOwnedState}
          clearRevokedIdentityOwnedState={clearRevokedIdentityOwnedState}
        >
          content
        </AppProviders>
      </MemoryRouter>,
    );

    const sessionProviderProps = vi
      .mocked(SessionProvider)
      .mock.calls.at(-1)?.[0];
    expect(sessionProviderProps?.clearIdentityOwnedState).toBe(
      clearIdentityOwnedState,
    );
    expect(sessionProviderProps?.clearRevokedIdentityOwnedState).toBe(
      clearRevokedIdentityOwnedState,
    );
  });

  it("owns the canonical production portal for dialogs and toasts", () => {
    const view = render(
      <MemoryRouter>
        <AppProviders>
          <main data-testid="app-content">
            <Dialog isOpen title="프로덕션 대화상자" onClose={vi.fn()}>
              dialog content
            </Dialog>
            <ToastHost message="프로덕션 알림" onClose={vi.fn()} />
          </main>
        </AppProviders>
      </MemoryRouter>,
    );

    const portalRoot = screen.getByTestId(APP_OVERLAY_ROOT_ID);
    expect(portalRoot).toHaveAttribute("id", APP_OVERLAY_ROOT_ID);
    expect(portalRoot).toContainElement(
      screen.getByRole("dialog", { name: "프로덕션 대화상자" }),
    );
    expect(portalRoot).toContainElement(screen.getByRole("alert"));
    expect(screen.getByTestId("app-content")).not.toContainElement(
      screen.getByRole("dialog", { name: "프로덕션 대화상자" }),
    );

    view.unmount();
    expect(screen.queryByTestId(APP_OVERLAY_ROOT_ID)).not.toBeInTheDocument();
  });

  it("composes feature auth commands in the stable session boundary", async () => {
    const session = createAnonymousSession();
    mockUseSession.mockReturnValue(session);
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <MemoryRouter>
        <AuthIntentStableBoundary>{children}</AuthIntentStableBoundary>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useAuthCommands(), { wrapper });

    expect(result.current.login).toBe(session.login);
    expect(result.current.shouldCompleteLoginInCurrentView()).toBe(true);

    const signupCommand = {
      nickname: "Guest",
      email: "guest@example.com",
      password: "password123",
    };
    await act(async () => result.current.signup(signupCommand));
    expect(authApi.signup).toHaveBeenCalledWith(signupCommand);

    session.captureAuthenticatedSession.mockReturnValue({
      subject: toSessionSubject({
        id: 41,
        email: "guest@example.com",
        nickname: "Guest",
        thumbnailImageUrl: null,
      }),
      epoch: 2,
    });
    expect(result.current.shouldCompleteLoginInCurrentView()).toBe(false);
  });
});
