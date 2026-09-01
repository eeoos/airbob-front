import type { Mocked } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { authApi } from "../../features/auth/api/authApi";
import { useAuthCommands } from "../../features/auth/ports/AuthCommandProvider";
import { Dialog, ToastHost } from "../../shared/ui";
import { testSessionRuntimeLeaseId } from "../../test/sessionFixtures";
import {
  SessionProvider,
  type SessionContextValue,
} from "../session/SessionProvider";
import {
  usePaymentCallbackCredentialClaim,
  usePaymentRecoveryFenceStatus,
} from "../router/PaymentCallbackCredentialBoundary";
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

  it("passes cleanup and candidate reconciliation ports to the session owner", () => {
    const clearIdentityOwnedState = vi.fn();
    const clearRevokedIdentityOwnedState = vi.fn();
    const reconcileCandidateIdentityOwnedState = vi.fn(() => "ready" as const);

    render(
      <MemoryRouter>
        <AppProviders
          clearIdentityOwnedState={clearIdentityOwnedState}
          clearRevokedIdentityOwnedState={clearRevokedIdentityOwnedState}
          reconcileCandidateIdentityOwnedState={
            reconcileCandidateIdentityOwnedState
          }
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
    expect(sessionProviderProps?.clearRevokedIdentityOwnedState).toEqual(
      expect.any(Function),
    );
    sessionProviderProps?.clearRevokedIdentityOwnedState?.("explicit-logout");
    expect(clearRevokedIdentityOwnedState).toHaveBeenCalledTimes(1);
    expect(clearIdentityOwnedState).not.toHaveBeenCalled();
    const forwardedReconciliation =
      sessionProviderProps?.reconcileCandidateIdentityOwnedState;
    expect(forwardedReconciliation).toEqual(expect.any(Function));
    forwardedReconciliation?.({
      subject: toSessionSubject({
        id: 41,
        email: "guest@example.com",
        nickname: "Guest",
        thumbnailImageUrl: null,
      }),
      epoch: 2,
      runtimeLeaseId: testSessionRuntimeLeaseId,
    });
    expect(reconcileCandidateIdentityOwnedState).toHaveBeenCalledTimes(1);
  });

  it.each(["recovery-required", "recovery-unavailable"] as const)(
    "invalidates a scrubbed callback before publishing %s commands",
    async (status) => {
      const callbackPath = "/reservations/reservation-1/success";
      const callbackSearch =
        "?paymentKey=payment-key-1&orderId=reservation-1&amount=120000";
      window.history.replaceState(
        { idx: 0, key: "callback", usr: { paymentKey: "secret" } },
        "",
        `${callbackPath}${callbackSearch}`,
      );
      const reconcileCandidateIdentityOwnedState = vi.fn(() => status);

      function CredentialProbe() {
        const claim = usePaymentCallbackCredentialClaim();
        const recoveryFenceStatus = usePaymentRecoveryFenceStatus();
        return (
          <output data-testid="callback-claim">
            {`${claim.status}:${recoveryFenceStatus}`}
          </output>
        );
      }

      render(
        <MemoryRouter initialEntries={[`${callbackPath}${callbackSearch}`]}>
          <AppProviders
            reconcileCandidateIdentityOwnedState={
              reconcileCandidateIdentityOwnedState
            }
          >
            <CredentialProbe />
          </AppProviders>
        </MemoryRouter>,
      );

      expect(await screen.findByTestId("callback-claim")).toHaveTextContent(
        "fresh:none",
      );
      const forwardedReconciliation = vi
        .mocked(SessionProvider)
        .mock.calls.at(-1)?.[0].reconcileCandidateIdentityOwnedState;
      expect(forwardedReconciliation).toEqual(expect.any(Function));

      act(() => {
        forwardedReconciliation?.({
          subject: toSessionSubject({
            id: 41,
            email: "guest@example.com",
            nickname: "Guest",
            thumbnailImageUrl: null,
          }),
          epoch: 2,
          runtimeLeaseId: testSessionRuntimeLeaseId,
        });
      });

      expect(screen.getByTestId("callback-claim")).toHaveTextContent(
        `invalid:${status}`,
      );
      expect(screen.getByTestId("callback-claim")).not.toHaveTextContent(
        "payment-key-1",
      );
    },
  );

  it("claims a matching pending callback before publishing its candidate identity", async () => {
    const callbackPath = "/reservations/reservation-1/success";
    const callbackSearch =
      "?paymentKey=payment-key-1&orderId=reservation-1&amount=120000";
    window.history.replaceState(null, "", `${callbackPath}${callbackSearch}`);
    const claimCandidatePaymentCallbackCredential = vi.fn(
      () => "claimed" as const,
    );
    const reconcileCandidateIdentityOwnedState = vi.fn(
      () => "recovery-required" as const,
    );

    function CredentialProbe() {
      const claim = usePaymentCallbackCredentialClaim();
      const recoveryFenceStatus = usePaymentRecoveryFenceStatus();
      return (
        <output data-testid="claimed-callback">
          {`${claim.status}:${recoveryFenceStatus}`}
        </output>
      );
    }

    render(
      <MemoryRouter initialEntries={[`${callbackPath}${callbackSearch}`]}>
        <AppProviders
          claimCandidatePaymentCallbackCredential={
            claimCandidatePaymentCallbackCredential
          }
          reconcileCandidateIdentityOwnedState={
            reconcileCandidateIdentityOwnedState
          }
        >
          <CredentialProbe />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("claimed-callback")).toHaveTextContent(
      "fresh:none",
    );
    const forwardedReconciliation = vi
      .mocked(SessionProvider)
      .mock.calls.at(-1)?.[0].reconcileCandidateIdentityOwnedState;
    const scope = {
      subject: toSessionSubject({
        id: 41,
        email: "guest@example.com",
        nickname: "Guest",
        thumbnailImageUrl: null,
      }),
      epoch: 2,
      runtimeLeaseId: testSessionRuntimeLeaseId,
    };

    act(() => forwardedReconciliation?.(scope));

    expect(claimCandidatePaymentCallbackCredential).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({
        reservationUid: "reservation-1",
        orderId: "reservation-1",
        paymentKey: "payment-key-1",
        amount: 120000,
      }),
    );
    expect(screen.getByTestId("claimed-callback")).toHaveTextContent(
      "fresh:none",
    );
  });

  it("preserves v2 recovery during an anonymous callback bootstrap cleanup", async () => {
    const callbackPath = "/reservations/reservation-1/success";
    const callbackSearch =
      "?paymentKey=payment-key-1&orderId=reservation-1&amount=120000";
    window.history.replaceState(null, "", `${callbackPath}${callbackSearch}`);
    const clearIdentityOwnedState = vi.fn();
    const clearRevokedIdentityOwnedState = vi.fn();

    render(
      <MemoryRouter initialEntries={[`${callbackPath}${callbackSearch}`]}>
        <AppProviders
          clearIdentityOwnedState={clearIdentityOwnedState}
          clearRevokedIdentityOwnedState={clearRevokedIdentityOwnedState}
        >
          content
        </AppProviders>
      </MemoryRouter>,
    );

    await screen.findByText("content");
    const cleanup = vi
      .mocked(SessionProvider)
      .mock.calls.at(-1)?.[0].clearRevokedIdentityOwnedState;
    expect(cleanup).toEqual(expect.any(Function));

    act(() => cleanup?.("authentication-rejected"));

    expect(clearIdentityOwnedState).not.toHaveBeenCalled();
    expect(clearRevokedIdentityOwnedState).not.toHaveBeenCalled();
  });

  it.each([
    "authenticated-session-revoked",
    "explicit-logout",
    "identity-replaced",
  ] as const)(
    "discards a pending callback and clears v2 state for %s",
    async (reason) => {
      const callbackPath = "/reservations/reservation-1/success";
      const callbackSearch =
        "?paymentKey=payment-key-1&orderId=reservation-1&amount=120000";
      window.history.replaceState(null, "", `${callbackPath}${callbackSearch}`);
      const clearRevokedIdentityOwnedState = vi.fn();

      function CredentialProbe() {
        const claim = usePaymentCallbackCredentialClaim();
        return <output data-testid="callback-status">{claim.status}</output>;
      }

      render(
        <MemoryRouter initialEntries={[`${callbackPath}${callbackSearch}`]}>
          <AppProviders
            clearRevokedIdentityOwnedState={clearRevokedIdentityOwnedState}
          >
            <CredentialProbe />
          </AppProviders>
        </MemoryRouter>,
      );

      expect(await screen.findByTestId("callback-status")).toHaveTextContent(
        "fresh",
      );
      const cleanup = vi
        .mocked(SessionProvider)
        .mock.calls.at(-1)?.[0].clearRevokedIdentityOwnedState;

      act(() => cleanup?.(reason));

      expect(clearRevokedIdentityOwnedState).toHaveBeenCalledOnce();
      expect(screen.getByTestId("callback-status")).toHaveTextContent(
        "invalid",
      );
    },
  );

  it("keeps the pending callback private and blocks publication on claim storage failure", async () => {
    const callbackPath = "/reservations/reservation-1/success";
    const callbackSearch =
      "?paymentKey=payment-key-1&orderId=reservation-1&amount=120000";
    window.history.replaceState(null, "", `${callbackPath}${callbackSearch}`);
    const reconcileCandidateIdentityOwnedState = vi.fn(
      () => "recovery-required" as const,
    );

    function CredentialProbe() {
      const claim = usePaymentCallbackCredentialClaim();
      const recoveryFenceStatus = usePaymentRecoveryFenceStatus();
      return (
        <output data-testid="callback-claim">
          {`${claim.status}:${recoveryFenceStatus}`}
        </output>
      );
    }

    render(
      <MemoryRouter initialEntries={[`${callbackPath}${callbackSearch}`]}>
        <AppProviders
          claimCandidatePaymentCallbackCredential={() => "blocked"}
          reconcileCandidateIdentityOwnedState={
            reconcileCandidateIdentityOwnedState
          }
        >
          <CredentialProbe />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("callback-claim")).toHaveTextContent(
      "fresh:none",
    );
    const forwardedReconciliation = vi
      .mocked(SessionProvider)
      .mock.calls.at(-1)?.[0].reconcileCandidateIdentityOwnedState;

    expect(() =>
      forwardedReconciliation?.({
        subject: toSessionSubject({
          id: 41,
          email: "guest@example.com",
          nickname: "Guest",
          thumbnailImageUrl: null,
        }),
        epoch: 2,
        runtimeLeaseId: testSessionRuntimeLeaseId,
      }),
    ).toThrow("Candidate payment callback could not be reconciled.");
    expect(reconcileCandidateIdentityOwnedState).not.toHaveBeenCalled();
    expect(screen.getByTestId("callback-claim")).toHaveTextContent(
      "fresh:none",
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
      runtimeLeaseId: testSessionRuntimeLeaseId,
    });
    expect(result.current.shouldCompleteLoginInCurrentView()).toBe(false);
  });
});
