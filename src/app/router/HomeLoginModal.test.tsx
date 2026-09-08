import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { HomeLoginModal } from "./HomeLoginModal";
import LoginRoute from "./routes/LoginRoute";

const mockCaptureSession = vi.fn();
const mockIsCurrentSession = vi.fn();
const mockIsCurrentHistoryEntry = vi.fn();
const mockPendingPayment = vi.fn();

vi.mock("../session/useSession", () => ({
  useSession: () => ({
    captureAuthenticatedSession: mockCaptureSession,
    isCurrentSession: mockIsCurrentSession,
  }),
}));
vi.mock("../../platform/browser/windowNavigation", () => ({
  browserWindowNavigation: {
    isCurrentHistoryEntry: (...args: unknown[]) =>
      mockIsCurrentHistoryEntry(...args),
  },
}));
vi.mock("./PaymentCallbackCredentialBoundary", () => ({
  usePendingPaymentRecoveryReturn: () => mockPendingPayment,
}));
vi.mock("../../features/auth/public", () => ({
  DeferredAuthModal: ({ onClose }: { onClose(): void }) => (
    <div role="dialog" aria-label="로그인">
      <button type="button" onClick={onClose}>
        닫기
      </button>
    </div>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {JSON.stringify({
        path: `${location.pathname}${location.search}${location.hash}`,
        state: location.state,
      })}
    </output>
  );
}

function LoginHarness({
  state = null,
  pathname = "/",
}: {
  readonly state?: unknown;
  readonly pathname?: string;
}) {
  return (
    <StrictMode>
      <MemoryRouter initialEntries={[{ pathname, state }]}>
        <LocationProbe />
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/"
            element={
              <>
                <h1>홈</h1>
                <HomeLoginModal />
              </>
            }
          />
          <Route path="*" element={<h1>목적지</h1>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>
  );
}

const savedPage = {
  from: { pathname: "/wishlist", search: "?id=7", hash: "#memo" },
};
const loginState = { authModal: "login", returnTo: savedPage };
const expectLocation = (path: string, state: unknown = null) => {
  expect(screen.getByTestId("location")).toHaveTextContent(
    JSON.stringify({ path, state }),
  );
};

beforeEach(() => {
  mockCaptureSession.mockReturnValue(null);
  mockIsCurrentSession.mockReturnValue(true);
  mockIsCurrentHistoryEntry.mockReturnValue(true);
  mockPendingPayment.mockReturnValue(null);
});

describe("home login modal navigation", () => {
  it("keeps the normal home free of login prompts", () => {
    render(<LoginHarness />);
    expect(screen.getByRole("heading", { name: "홈" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("replaces the legacy login page with the home login modal", () => {
    render(<LoginHarness pathname="/login" state={savedPage} />);
    expect(screen.getByRole("heading", { name: "홈" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "로그인" })).toBeInTheDocument();
    expectLocation("/", loginState);
  });

  it("clears the pending return when dismissed, including after a later login", () => {
    const view = render(<LoginHarness state={loginState} />);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expectLocation("/");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    mockCaptureSession.mockReturnValue({ epoch: 1 });
    view.rerender(<LoginHarness state={loginState} />);
    expectLocation("/");
  });

  it("restores the full protected URL after authenticated session publication", () => {
    const view = render(<LoginHarness state={loginState} />);
    mockCaptureSession.mockReturnValue({ epoch: 1 });
    view.rerender(<LoginHarness state={loginState} />);
    expectLocation("/wishlist?id=7#memo");
  });

  it.each(["history", "session"])("does not resume a stale %s", (kind) => {
    mockCaptureSession.mockReturnValue({ epoch: 1 });
    (kind === "history"
      ? mockIsCurrentHistoryEntry
      : mockIsCurrentSession
    ).mockReturnValue(false);
    render(<LoginHarness state={loginState} />);
    expectLocation("/", loginState);
  });

  it("drops hostile legacy return targets", () => {
    render(
      <LoginHarness
        pathname="/login"
        state={{
          from: {
            pathname: "//evil.example/steal",
            search: "",
            hash: "",
          },
        }}
      />,
    );
    expectLocation("/", { authModal: "login", returnTo: null });
  });

  it("resumes only the exact credential-free pending payment callback", () => {
    mockCaptureSession.mockReturnValue({ epoch: 1 });
    mockPendingPayment.mockReturnValue("reservation-7");
    render(
      <LoginHarness
        state={{
          authModal: "login",
          returnTo: {
            from: {
              pathname: "/reservations/reservation-7/success",
              search: "",
              hash: "",
            },
          },
        }}
      />,
    );
    expectLocation("/reservations/reservation-7/success");
  });

  it("drops unclaimed payment return paths after a refresh or account change", () => {
    mockCaptureSession.mockReturnValue({ epoch: 1 });
    render(
      <LoginHarness
        state={{
          authModal: "login",
          returnTo: {
            from: {
              pathname: "/reservations/reservation-7/success",
              search: "",
              hash: "",
            },
          },
        }}
      />,
    );
    expectLocation("/");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
