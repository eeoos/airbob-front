import React from "react";
import { render, screen, within } from "@testing-library/react";
import App from "./App";

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
  { path: "/", pageTestId: "page-home" },
  { path: "/search", pageTestId: "page-search" },
  { path: "/accommodations/:id", pageTestId: "page-accommodation-detail" },
  {
    path: "/accommodations/:id/confirm",
    pageTestId: "page-reservation-confirm",
  },
  { path: "/accommodations/:id/edit", pageTestId: "page-accommodation-edit" },
  { path: "/wishlist", pageTestId: "page-wishlist" },
  { path: "/profile", pageTestId: "page-profile" },
  {
    path: "/profile/host/reservations/:reservationUid",
    pageTestId: "page-host-reservation-detail",
  },
  {
    path: "/reservations/:reservationUid",
    pageTestId: "page-reservation-detail",
  },
  {
    path: "/reservations/:reservationUid/review",
    pageTestId: "page-review-create",
  },
  {
    path: "/reservations/:reservationUid/success",
    pageTestId: "page-payment-success",
  },
  {
    path: "/reservations/:reservationUid/fail",
    pageTestId: "page-payment-fail",
  },
  { path: "/login", pageTestId: "page-login" },
  { path: "/signup", pageTestId: "page-signup" },
  { path: "*", pageTestId: "page-not-found" },
];

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
