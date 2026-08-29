import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import type { SessionContextValue } from "../app/session/SessionProvider";
import {
  toSessionSubject,
  type SessionState,
  type SessionViewer,
} from "../app/session/sessionState";
import { useSession } from "../app/session/useSession";
import { AppError } from "../platform/http/errors";
import RequireAuth from "./RequireAuth";
import { routeTo } from "./paths";

jest.mock("../app/session/useSession", () => ({
  useSession: jest.fn(),
}));

const mockLocation = {
  pathname: "/wishlist",
  search: "?view=recently-viewed",
  hash: "#saved",
  state: null,
  key: "test-location",
};

jest.mock(
  "react-router-dom",
  () => ({
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
  }),
  { virtual: true },
);

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

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

const createSessionValue = (
  state: SessionState,
): jest.Mocked<SessionContextValue> =>
  ({
    state,
    login: jest.fn(),
    logout: jest.fn(),
    revalidate: jest.fn().mockResolvedValue(undefined),
    retryServerLogout: jest.fn(),
    captureAuthenticatedSession: jest.fn(),
    isCurrentSession: jest.fn(),
  }) as jest.Mocked<SessionContextValue>;

const renderRequireAuth = (state: SessionState) => {
  const session = createSessionValue(state);
  mockUseSession.mockReturnValue(session);

  return {
    ...render(
      <RequireAuth>
        <div>보호된 페이지</div>
      </RequireAuth>,
    ),
    session,
  };
};

describe("RequireAuth session state handling", () => {
  beforeEach(() => {
    mockUseSession.mockReset();
  });

  it("keeps the route pending during a session check without redirecting", () => {
    renderRequireAuth({
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
    const { session } = renderRequireAuth({
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
    renderRequireAuth({
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
      renderRequireAuth(authenticatedState(revalidation));

      expect(screen.getByText("보호된 페이지")).toBeInTheDocument();
      expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
      expect(
        screen.queryByText("로그인 상태를 확인하는 중..."),
      ).not.toBeInTheDocument();
    },
  );
});
