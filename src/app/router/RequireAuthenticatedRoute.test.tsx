import type { Mocked, MockedFunction } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SessionContextValue } from "../session/SessionProvider";
import {
  toSessionSubject,
  type SessionState,
  type SessionViewer,
} from "../session/sessionState";
import { useSession } from "../session/useSession";
import { AppError } from "../../platform/http/errors";
import { RequireAuthenticatedRoute } from "./RequireAuthenticatedRoute";
import { routeTo } from "./paths";

vi.mock("../session/useSession", () => ({
  useSession: vi.fn(),
}));

const mockLocation = {
  pathname: "/wishlist",
  search: "?view=recently-viewed",
  hash: "#saved",
  state: null,
  key: "test-location",
};

vi.mock("react-router-dom", () => ({
  Navigate: ({
    to,
    replace,
    state,
  }: {
    to: string;
    replace?: boolean;
    state?: unknown;
  }) => (
    <div
      data-testid="navigate"
      data-replace={String(replace)}
      data-state={JSON.stringify(state)}
      data-to={to}
    />
  ),
  useLocation: () => mockLocation,
}));

const mockUseSession = useSession as MockedFunction<typeof useSession>;

const viewer: SessionViewer = {
  id: 41,
  email: "guest@example.com",
  nickname: "Guest",
  thumbnailImageUrl: null,
};

const sessionError = new AppError({
  kind: "network",
  code: "SESSION_CHECK_FAILED",
  message: "Session check failed.",
  retryable: true,
});

const authenticatedState = (
  revalidation: Extract<
    SessionState,
    { status: "authenticated" }
  >["revalidation"],
): SessionState => ({
  status: "authenticated",
  viewer,
  subject: toSessionSubject(viewer),
  epoch: 2,
  revalidation,
});

const createSessionValue = (state: SessionState): Mocked<SessionContextValue> =>
  ({
    state,
    login: vi.fn(),
    logout: vi.fn(),
    revalidate: vi.fn().mockResolvedValue(undefined),
    retryServerLogout: vi.fn(),
    captureAuthenticatedSession: vi.fn(),
    isCurrentSession: vi.fn(),
  }) as Mocked<SessionContextValue>;

const renderRequireAuthenticatedRoute = (state: SessionState) => {
  const session = createSessionValue(state);
  mockUseSession.mockReturnValue(session);

  return {
    ...render(
      <RequireAuthenticatedRoute>
        <div>보호된 페이지</div>
      </RequireAuthenticatedRoute>,
    ),
    session,
  };
};

describe("RequireAuthenticatedRoute session state handling", () => {
  beforeEach(() => {
    mockUseSession.mockReset();
  });

  it("keeps the route pending during a session check without redirecting", () => {
    renderRequireAuthenticatedRoute({
      status: "checking",
      reason: "bootstrap",
      operationId: 1,
      epoch: 0,
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "로그인 상태를 확인하는 중...",
    );
    expect(screen.queryByText("보호된 페이지")).not.toBeInTheDocument();
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });

  it("shows a retryable bootstrap error and delegates retry to revalidate", () => {
    const { session } = renderRequireAuthenticatedRoute({
      status: "error",
      reason: "bootstrap",
      operationId: 1,
      epoch: 0,
      error: sessionError,
      retryable: true,
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "로그인 상태를 확인하지 못했어요",
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(session.revalidate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });

  it("redirects an anonymous session with the exact structured return target", () => {
    renderRequireAuthenticatedRoute({
      status: "anonymous",
      reason: "bootstrap",
      revocation: "verified",
      operationId: 1,
      epoch: 0,
    });

    const redirect = screen.getByTestId("navigate");
    expect(redirect).toHaveAttribute("data-to", routeTo.login());
    expect(redirect).toHaveAttribute("data-replace", "true");
    expect(redirect).toHaveAttribute(
      "data-state",
      JSON.stringify({
        from: {
          pathname: mockLocation.pathname,
          search: mockLocation.search,
          hash: mockLocation.hash,
        },
      }),
    );
    expect(screen.queryByText("보호된 페이지")).not.toBeInTheDocument();
  });

  it.each([
    ["idle", { status: "idle" } as const],
    ["checking", { status: "checking", operationId: 3 } as const],
    [
      "error",
      { status: "error", operationId: 3, error: sessionError } as const,
    ],
  ])(
    "keeps the protected child mounted while authenticated revalidation is %s",
    (_name, revalidation) => {
      renderRequireAuthenticatedRoute(authenticatedState(revalidation));

      expect(screen.getByText("보호된 페이지")).toBeInTheDocument();
      expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
      expect(
        screen.queryByText("로그인 상태를 확인하는 중..."),
      ).not.toBeInTheDocument();
    },
  );
});
