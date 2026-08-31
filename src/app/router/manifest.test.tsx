import { readFileSync } from "fs";
import { join } from "path";
import { routeDefinitions } from "./definitions";
import { lazyRoutes } from "./lazyRoutes";
import { routeManifest } from "./manifest";
import { ROUTE_PATHS } from "./paths";

const lazyRoutesSource = () =>
  readFileSync(join(process.cwd(), "src/app/router/lazyRoutes.tsx"), "utf8");

const collectLazyImportTargets = (source: string) =>
  Array.from(source.matchAll(/import\("([^"]+)"\)/g))
    .map((match) => match[1])
    .filter((target): target is string => Boolean(target));

describe("active app route manifest", () => {
  it("combines component-free definitions with one lazy adapter per route", () => {
    expect(
      routeManifest.map(({ component, ...definition }) => definition),
    ).toEqual(routeDefinitions);
    expect(routeManifest).toHaveLength(15);

    routeManifest.forEach(({ id, component }) => {
      expect(component).toBe(lazyRoutes[id]);
    });
  });

  it("declares protected routes and semantic shells explicitly", () => {
    expect(
      routeDefinitions
        .filter(({ auth }) => auth === "authenticated")
        .map(({ path }) => path),
    ).toEqual([
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
    expect(
      routeDefinitions
        .filter(({ shell }) => shell === "bare")
        .map(({ path }) => path),
    ).toEqual([ROUTE_PATHS.notFound]);
    expect(
      routeDefinitions
        .filter(({ shell }) => shell === "form")
        .map(({ path }) => path),
    ).toEqual([
      ROUTE_PATHS.reviewCreate,
      ROUTE_PATHS.login,
      ROUTE_PATHS.signup,
    ]);
  });

  it("uses 15 unique literal imports for route-level adapter chunks", () => {
    const source = lazyRoutesSource();
    const lazyImportTargets = collectLazyImportTargets(source);

    expect(lazyImportTargets).toHaveLength(routeDefinitions.length);
    expect(new Set(lazyImportTargets).size).toBe(lazyImportTargets.length);
    expect(
      lazyImportTargets.every((target) => target.startsWith("./routes/")),
    ).toBe(true);
    expect(source).not.toMatch(/\.\.\/(?:features|pages)\//);
    expect(lazyImportTargets).not.toContain("./routes");
    expect(lazyImportTargets).toEqual(
      expect.arrayContaining([
        "./routes/HomeRoute",
        "./routes/SearchRoute",
        "./routes/AccommodationEditRoute",
        "./routes/ReservationDetailRoute",
        "./routes/PaymentSuccessRoute",
        "./routes/NotFoundRoute",
      ]),
    );
  });
});
