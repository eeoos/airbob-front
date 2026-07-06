import { readFileSync } from "fs";
import { join } from "path";
import { ROUTE_PATHS } from "./paths";
import { appRoutes } from "./routeConfig";
import { routeDefinitions } from "./routeDefinitions";

jest.mock("../features/home", () => ({ HomeRoute: () => null }));
jest.mock("../features/search", () => ({ SearchRoute: () => null }));
jest.mock("../features/accommodations", () => ({
  AccommodationDetailRoute: () => null,
}));
jest.mock("../features/accommodations/edit", () => ({
  AccommodationEditRoute: () => null,
}));
jest.mock("../features/wishlist", () => ({ WishlistRoute: () => null }));
jest.mock("../features/profile", () => ({ ProfileRoute: () => null }));
jest.mock("../features/reservations", () => ({
  HostReservationDetailRoute: () => null,
  PaymentFailRoute: () => null,
  PaymentSuccessRoute: () => null,
  ReservationConfirmRoute: () => null,
  ReservationDetailRoute: () => null,
}));
jest.mock("../features/reviews", () => ({ ReviewCreateRoute: () => null }));
jest.mock("../features/auth", () => ({
  LoginRoute: () => null,
  SignupRoute: () => null,
}));
jest.mock("./NotFoundRoute", () => ({ NotFoundRoute: () => null }));

describe("app route config", () => {
  it("builds lazy app routes from component-free route definitions", () => {
    expect(appRoutes.map(({ component, ...route }) => route)).toEqual(
      routeDefinitions,
    );
  });

  it("declares protected routes explicitly", () => {
    const protectedPaths = routeDefinitions
      .filter((route) => route.requiresAuth)
      .map((route) => route.path);

    expect(protectedPaths).toEqual([
      ROUTE_PATHS.accommodationConfirm,
      ROUTE_PATHS.accommodationEdit,
      ROUTE_PATHS.wishlist,
      ROUTE_PATHS.profile,
      ROUTE_PATHS.hostReservationDetail,
      ROUTE_PATHS.reservationDetail,
      ROUTE_PATHS.reviewCreate,
      ROUTE_PATHS.paymentSuccess,
      ROUTE_PATHS.paymentFail,
    ]);
  });

  it("declares layout ownership explicitly", () => {
    const barePaths = routeDefinitions
      .filter((route) => route.layout === "bare")
      .map((route) => route.path);

    expect(barePaths).toEqual([
      ROUTE_PATHS.login,
      ROUTE_PATHS.signup,
      ROUTE_PATHS.notFound,
    ]);
  });

  it("uses lazy route components so feature routes can split by route", () => {
    const source = readFileSync(
      join(process.cwd(), "src/routes/routeConfig.tsx"),
      "utf8"
    );

    expect(source).toContain("React.lazy");
    expect(source).not.toMatch(/\.\.\/pages\//);
    expect(source).toContain("../features/home");
    expect(source).toContain("HomeRoute");
    expect(source).toContain("SearchRoute");
    expect(source).toContain("ReservationDetailRoute");
  });
});
