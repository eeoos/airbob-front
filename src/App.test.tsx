import React from "react";
import { render, screen, within } from "@testing-library/react";
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
    Route: ({ path, element }: { path: string; element: React.ReactNode }) => (
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
  { path: "/", pageTestId: "page-home", requiresAuth: false },
  { path: "/search", pageTestId: "page-search", requiresAuth: false },
  {
    path: "/accommodations/:id",
    pageTestId: "page-accommodation-detail",
    requiresAuth: false,
  },
  {
    path: "/accommodations/:id/confirm",
    pageTestId: "page-reservation-confirm",
    requiresAuth: false,
  },
  {
    path: "/accommodations/:id/edit",
    pageTestId: "page-accommodation-edit",
    requiresAuth: true,
  },
  { path: "/wishlist", pageTestId: "page-wishlist", requiresAuth: true },
  { path: "/profile", pageTestId: "page-profile", requiresAuth: true },
  {
    path: "/profile/host/reservations/:reservationUid",
    pageTestId: "page-host-reservation-detail",
    requiresAuth: true,
  },
  {
    path: "/reservations/:reservationUid",
    pageTestId: "page-reservation-detail",
    requiresAuth: true,
  },
  {
    path: "/reservations/:reservationUid/review",
    pageTestId: "page-review-create",
    requiresAuth: true,
  },
  {
    path: "/reservations/:reservationUid/success",
    pageTestId: "page-payment-success",
    requiresAuth: true,
  },
  {
    path: "/reservations/:reservationUid/fail",
    pageTestId: "page-payment-fail",
    requiresAuth: true,
  },
  { path: "/login", pageTestId: "page-login", requiresAuth: false },
  { path: "/signup", pageTestId: "page-signup", requiresAuth: false },
  { path: "*", pageTestId: "page-not-found", requiresAuth: false },
];

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseAuth.mockReturnValue(
    createAuthState({ isAuthenticated: true, isLoading: false })
  );
});

test("renders the complete configured route table", () => {
  render(<App />);

  expect(screen.getByTestId("browser-router")).toBeInTheDocument();
  expect(screen.getAllByTestId(/^route-/)).toHaveLength(routeMappings.length);

  routeMappings.forEach(({ path, pageTestId }) => {
    const route = screen.getByTestId(`route-${path}`);

    expect(route).toHaveTextContent(path);
    expect(within(route).getByTestId(pageTestId)).toBeInTheDocument();
  });
});

test("classifies route elements by auth requirement for unauthenticated users", () => {
  mockUseAuth.mockReturnValue(
    createAuthState({ isAuthenticated: false, isLoading: false })
  );

  render(<App />);

  routeMappings.forEach(({ path, pageTestId, requiresAuth }) => {
    const route = screen.getByTestId(`route-${path}`);

    if (requiresAuth) {
      expect(within(route).getByTestId("navigate")).toHaveTextContent("/");
      expect(within(route).queryByTestId(pageTestId)).not.toBeInTheDocument();
      return;
    }

    expect(within(route).getByTestId(pageTestId)).toBeInTheDocument();
    expect(within(route).queryByTestId("navigate")).not.toBeInTheDocument();
  });
});
