import { readFileSync } from "fs";
import { join } from "path";
import { ROUTE_PATHS } from "./paths";
import { appRoutes } from "./routeConfig";

jest.mock("../pages/Home/Home", () => () => null);
jest.mock("../pages/Search/Search", () => () => null);
jest.mock("../pages/AccommodationDetail/AccommodationDetail", () => () => null);
jest.mock("../pages/AccommodationEdit/AccommodationEdit", () => () => null);
jest.mock("../pages/Wishlist/Wishlist", () => () => null);
jest.mock("../pages/Profile/Profile", () => () => null);
jest.mock("../pages/Reservations/ReservationDetail", () => () => null);
jest.mock(
  "../pages/Profile/HostReservationDetail/HostReservationDetail",
  () => () => null
);
jest.mock("../pages/Reservations/ReservationConfirm", () => () => null);
jest.mock("../pages/Reservations/ReviewCreate", () => () => null);
jest.mock("../pages/Reservations/PaymentSuccess", () => () => null);
jest.mock("../pages/Reservations/PaymentFail", () => () => null);
jest.mock("../pages/Auth/Login/Login", () => () => null);
jest.mock("../pages/Auth/Signup/Signup", () => () => null);
jest.mock("../pages/NotFound/NotFound", () => () => null);

describe("app route config", () => {
  it("keeps the complete route table in one place", () => {
    expect(appRoutes.map((route) => route.path)).toEqual([
      ROUTE_PATHS.home,
      ROUTE_PATHS.search,
      ROUTE_PATHS.accommodationDetail,
      ROUTE_PATHS.accommodationConfirm,
      ROUTE_PATHS.accommodationEdit,
      ROUTE_PATHS.wishlist,
      ROUTE_PATHS.profile,
      ROUTE_PATHS.hostReservationDetail,
      ROUTE_PATHS.reservationDetail,
      ROUTE_PATHS.reviewCreate,
      ROUTE_PATHS.paymentSuccess,
      ROUTE_PATHS.paymentFail,
      ROUTE_PATHS.login,
      ROUTE_PATHS.signup,
      ROUTE_PATHS.notFound,
    ]);
  });

  it("declares protected routes explicitly", () => {
    const protectedPaths = appRoutes
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
    const barePaths = appRoutes
      .filter((route) => route.layout === "bare")
      .map((route) => route.path);

    expect(barePaths).toEqual([
      ROUTE_PATHS.login,
      ROUTE_PATHS.signup,
      ROUTE_PATHS.notFound,
    ]);
  });

  it("uses lazy route components so pages can split by route", () => {
    const source = readFileSync(
      join(process.cwd(), "src/routes/routeConfig.tsx"),
      "utf8"
    );

    expect(source).toContain("React.lazy");
    expect(source).not.toMatch(/import\s+\w+\s+from\s+["']\.\.\/pages\//);
  });
});
