import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import App from "./App";

const mockUseAuth = jest.fn();

const createAuthState = ({
  isAuthenticated,
  isLoading,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
}) => ({
  isAuthenticated,
  isLoading,
  login: jest.fn(),
  logout: jest.fn(),
  checkAuth: jest.fn(),
});

jest.mock("./hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock(
  "react-router-dom",
  () => ({
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="browser-router">{children}</div>
    ),
    Routes: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="routes">{children}</div>
    ),
    Route: ({
      path,
      element,
      children,
    }: {
      path?: string;
      element: React.ReactNode;
      children?: React.ReactNode;
    }) =>
      path === undefined ? (
        <div data-testid="main-layout-route">
          <div>{element}</div>
          <div>{children}</div>
        </div>
      ) : (
        <div data-testid={`route-${path}`}>
          {path}
          <div>{element}</div>
        </div>
      ),
    useNavigate: () => jest.fn(),
    useLocation: () => ({
      pathname: "/",
      search: "",
      hash: "",
      state: null,
      key: "test",
    }),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    useParams: () => ({}),
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
  }),
  { virtual: true }
);

jest.mock("./layouts", () => ({
  MainLayout: () => <div data-testid="main-layout" />,
}));

jest.mock("./shared/ui", () => ({
  LoadingState: ({ title }: { title: string }) => (
    <div data-testid="route-loading">{title}</div>
  ),
}));

jest.mock("./pages/Home/Home", () => () => <div data-testid="page-home" />);
jest.mock("./pages/Search/Search", () => () => <div data-testid="page-search" />);
jest.mock("./pages/AccommodationDetail/AccommodationDetail", () => () => (
  <div data-testid="page-accommodation-detail" />
));
jest.mock("./pages/AccommodationEdit/AccommodationEdit", () => () => (
  <div data-testid="page-accommodation-edit" />
));
jest.mock("./pages/Wishlist/Wishlist", () => () => (
  <div data-testid="page-wishlist" />
));
jest.mock("./pages/Profile/Profile", () => () => (
  <div data-testid="page-profile" />
));
jest.mock("./pages/Reservations/ReservationDetail", () => () => (
  <div data-testid="page-reservation-detail" />
));
jest.mock(
  "./pages/Profile/HostReservationDetail/HostReservationDetail",
  () => () => <div data-testid="page-host-reservation-detail" />
);
jest.mock("./pages/Reservations/ReservationConfirm", () => () => (
  <div data-testid="page-reservation-confirm" />
));
jest.mock("./pages/Reservations/ReviewCreate", () => () => (
  <div data-testid="page-review-create" />
));
jest.mock("./pages/Reservations/PaymentSuccess", () => () => (
  <div data-testid="page-payment-success" />
));
jest.mock("./pages/Reservations/PaymentFail", () => () => (
  <div data-testid="page-payment-fail" />
));
jest.mock("./pages/Auth/Login/Login", () => () => (
  <div data-testid="page-login" />
));
jest.mock("./pages/Auth/Signup/Signup", () => () => (
  <div data-testid="page-signup" />
));
jest.mock("./pages/NotFound/NotFound", () => () => (
  <div data-testid="page-not-found" />
));

const routeMappings = [
  { path: "/", pageTestId: "page-home", requiresAuth: false, layout: "main" },
  {
    path: "/search",
    pageTestId: "page-search",
    requiresAuth: false,
    layout: "main",
  },
  {
    path: "/accommodations/:id",
    pageTestId: "page-accommodation-detail",
    requiresAuth: false,
    layout: "main",
  },
  {
    path: "/accommodations/:id/confirm",
    pageTestId: "page-reservation-confirm",
    requiresAuth: true,
    layout: "main",
  },
  {
    path: "/accommodations/:id/edit",
    pageTestId: "page-accommodation-edit",
    requiresAuth: true,
    layout: "main",
  },
  { path: "/wishlist", pageTestId: "page-wishlist", requiresAuth: true, layout: "main" },
  { path: "/profile", pageTestId: "page-profile", requiresAuth: true, layout: "main" },
  {
    path: "/profile/host/reservations/:reservationUid",
    pageTestId: "page-host-reservation-detail",
    requiresAuth: true,
    layout: "main",
  },
  {
    path: "/reservations/:reservationUid",
    pageTestId: "page-reservation-detail",
    requiresAuth: true,
    layout: "main",
  },
  {
    path: "/reservations/:reservationUid/review",
    pageTestId: "page-review-create",
    requiresAuth: true,
    layout: "main",
  },
  {
    path: "/reservations/:reservationUid/success",
    pageTestId: "page-payment-success",
    requiresAuth: true,
    layout: "main",
  },
  {
    path: "/reservations/:reservationUid/fail",
    pageTestId: "page-payment-fail",
    requiresAuth: true,
    layout: "main",
  },
  { path: "/login", pageTestId: "page-login", requiresAuth: false, layout: "bare" },
  { path: "/signup", pageTestId: "page-signup", requiresAuth: false, layout: "bare" },
  { path: "*", pageTestId: "page-not-found", requiresAuth: false, layout: "bare" },
];

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseAuth.mockReturnValue(
    createAuthState({ isAuthenticated: true, isLoading: false })
  );
});

test("renders the complete configured route table", async () => {
  render(<App />);

  expect(screen.getByTestId("browser-router")).toBeInTheDocument();
  expect(screen.getAllByTestId(/^route-(\/|\*)/)).toHaveLength(routeMappings.length);
  expect(screen.getByTestId("main-layout-route")).toBeInTheDocument();

  await waitFor(() => {
    routeMappings.forEach(({ path, pageTestId }) => {
      const route = screen.getByTestId(`route-${path}`);

      expect(route).toHaveTextContent(path);
      expect(within(route).getByTestId(pageTestId)).toBeInTheDocument();
    });
  });
});

test("groups main routes under the main layout route", () => {
  render(<App />);

  const mainLayoutRoute = screen.getByTestId("main-layout-route");

  const mainRoutePaths = routeMappings
    .filter(({ layout }) => layout === "main")
    .map(({ path }) => path);
  const nonMainRoutePaths = routeMappings
    .filter(({ layout }) => layout !== "main")
    .map(({ path }) => path);

  mainRoutePaths.forEach((path) => {
    expect(within(mainLayoutRoute).getByTestId(`route-${path}`)).toBeInTheDocument();
  });
  nonMainRoutePaths.forEach((path) => {
    expect(within(mainLayoutRoute).queryByTestId(`route-${path}`)).not.toBeInTheDocument();
  });
});

test("classifies route elements by auth requirement for unauthenticated users", async () => {
  mockUseAuth.mockReturnValue(
    createAuthState({ isAuthenticated: false, isLoading: false })
  );

  render(<App />);

  await waitFor(() => {
    routeMappings
      .filter(({ requiresAuth }) => requiresAuth)
      .forEach(({ path, pageTestId }) => {
        const route = screen.getByTestId(`route-${path}`);

        expect(within(route).getByTestId("navigate")).toHaveTextContent("/");
        expect(within(route).queryByTestId(pageTestId)).not.toBeInTheDocument();
      });
  });

  await waitFor(() => {
    routeMappings
      .filter(({ requiresAuth }) => !requiresAuth)
      .forEach(({ path, pageTestId }) => {
      const route = screen.getByTestId(`route-${path}`);

      expect(within(route).getByTestId(pageTestId)).toBeInTheDocument();
      expect(within(route).queryByTestId("navigate")).not.toBeInTheDocument();
      });
  });
});
