import { readFileSync } from "fs";
import { join } from "path";
import { ROUTE_PATHS } from "./paths";
import { appRoutes } from "./routeConfig";
import { routeDefinitions } from "./routeDefinitions";

jest.mock("../features/home/HomeRoute", () => ({ HomeRoute: () => null }));
jest.mock("../features/search/SearchRoute", () => ({ SearchRoute: () => null }));
jest.mock("../features/accommodations/AccommodationDetailRoute", () => ({
  AccommodationDetailRoute: () => null,
}));
jest.mock("../features/accommodations/edit/AccommodationEditRoute", () => ({
  AccommodationEditRoute: () => null,
}));
jest.mock("../features/wishlist/WishlistRoute", () => ({
  WishlistRoute: () => null,
}));
jest.mock("../features/profile/ProfileRoute", () => ({ ProfileRoute: () => null }));
jest.mock("../features/reservations/ReservationDetailRoute", () => ({
  ReservationDetailRoute: () => null,
}));
jest.mock("../features/reservations/HostReservationDetailRoute", () => ({
  HostReservationDetailRoute: () => null,
}));
jest.mock("../features/reservations/ReservationConfirmRoute", () => ({
  ReservationConfirmRoute: () => null,
}));
jest.mock("../features/reservations/PaymentSuccessRoute", () => ({
  PaymentSuccessRoute: () => null,
}));
jest.mock("../features/reservations/PaymentFailRoute", () => ({
  PaymentFailRoute: () => null,
}));
jest.mock("../features/reviews/ReviewCreateRoute", () => ({
  ReviewCreateRoute: () => null,
}));
jest.mock("../features/auth/LoginRoute", () => ({ LoginRoute: () => null }));
jest.mock("../features/auth/SignupRoute", () => ({ SignupRoute: () => null }));
jest.mock("./NotFoundRoute", () => ({ NotFoundRoute: () => null }));

const routeConfigSource = () =>
  readFileSync(join(process.cwd(), "src/routes/routeConfig.tsx"), "utf8");

const collectLazyImportTargets = (source: string) =>
  Array.from(source.matchAll(/React\.lazy\(\(\)\s*=>\s*import\("([^"]+)"\)/g))
    .map((match) => match[1])
    .filter((target): target is string => Boolean(target));

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
    const source = routeConfigSource();

    expect(source).toContain("React.lazy");
    expect(source).not.toMatch(/\.\.\/pages\//);
    expect(source).toContain("../features/home/HomeRoute");
    expect(source).toContain("HomeRoute");
    expect(source).toContain("SearchRoute");
    expect(source).toContain("ReservationDetailRoute");
  });

  it("uses one lazy module target per route-level chunk", () => {
    const lazyImportTargets = collectLazyImportTargets(routeConfigSource());

    expect(lazyImportTargets).toHaveLength(routeDefinitions.length);
    expect(new Set(lazyImportTargets).size).toBe(lazyImportTargets.length);
    expect(lazyImportTargets).toEqual(
      expect.arrayContaining([
        "../features/reservations/HostReservationDetailRoute",
        "../features/reservations/PaymentFailRoute",
        "../features/reservations/PaymentSuccessRoute",
        "../features/reservations/ReservationConfirmRoute",
        "../features/reservations/ReservationDetailRoute",
        "../features/auth/LoginRoute",
        "../features/auth/SignupRoute",
      ]),
    );
    expect(lazyImportTargets).not.toContain("../features/reservations");
    expect(lazyImportTargets).not.toContain("../features/auth");
  });
});
