import React from "react";
import { render, screen } from "@testing-library/react";
import { useAuth } from "../hooks/useAuth";
import { routeTo } from "./paths";
import RequireAuth from "./RequireAuth";

jest.mock("../hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

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
    useLocation: () => ({
      pathname: "/wishlist",
      search: "?view=recently-viewed",
      hash: "",
      state: null,
      key: "test-location",
    }),
  }),
  { virtual: true }
);

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const renderRequireAuth = (authState: {
  isAuthenticated: boolean;
  isLoading: boolean;
}) => {
  mockUseAuth.mockReturnValue({
    ...authState,
    login: jest.fn(),
    logout: jest.fn(),
    checkAuth: jest.fn(),
  });

  return render(
    <RequireAuth>
      <div>보호된 페이지</div>
    </RequireAuth>
  );
};

afterEach(() => {
  jest.clearAllMocks();
});

test("renders loading text while auth state is loading", () => {
  renderRequireAuth({ isAuthenticated: false, isLoading: true });

  expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  expect(screen.queryByText("보호된 페이지")).not.toBeInTheDocument();
  expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
});

test("redirects unauthenticated users to login with a protected route return target", () => {
  renderRequireAuth({ isAuthenticated: false, isLoading: false });

  expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", routeTo.login());
  expect(screen.getByTestId("navigate")).toHaveAttribute("data-replace", "true");
  expect(screen.getByTestId("navigate")).toHaveAttribute(
    "data-state",
    JSON.stringify({
      from: {
        pathname: "/wishlist",
        search: "?view=recently-viewed",
        hash: "",
      },
    })
  );
  expect(screen.queryByText("보호된 페이지")).not.toBeInTheDocument();
});

test("renders child when authenticated", () => {
  renderRequireAuth({ isAuthenticated: true, isLoading: false });

  expect(screen.getByText("보호된 페이지")).toBeInTheDocument();
  expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
});
