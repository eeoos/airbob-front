import { readFileSync } from "fs";
import { join } from "path";

const projectRoot = process.cwd();
const featureRouteContainers = [
  {
    publicBarrel: "src/features/home/index.ts",
    lazyImport: "../features/home/HomeRoute",
    routeContainer: "HomeRoute",
  },
  {
    publicBarrel: "src/features/search/index.ts",
    lazyImport: "../features/search/SearchRoute",
    routeContainer: "SearchRoute",
  },
  {
    publicBarrel: "src/features/wishlist/index.ts",
    lazyImport: "../features/wishlist/WishlistRoute",
    routeContainer: "WishlistRoute",
  },
  {
    publicBarrel: "src/features/accommodations/index.ts",
    lazyImport: "../features/accommodations/AccommodationDetailRoute",
    routeContainer: "AccommodationDetailRoute",
  },
  {
    publicBarrel: "src/features/accommodations/edit/index.ts",
    lazyImport: "../features/accommodations/edit/AccommodationEditRoute",
    routeContainer: "AccommodationEditRoute",
  },
  {
    publicBarrel: "src/features/profile/index.ts",
    lazyImport: "../features/profile/ProfileRoute",
    routeContainer: "ProfileRoute",
  },
  {
    publicBarrel: "src/features/reservations/index.ts",
    lazyImport: "../features/reservations/HostReservationDetailRoute",
    routeContainer: "HostReservationDetailRoute",
  },
  {
    publicBarrel: "src/features/reservations/index.ts",
    lazyImport: "../features/reservations/PaymentSuccessRoute",
    routeContainer: "PaymentSuccessRoute",
  },
  {
    publicBarrel: "src/features/reservations/index.ts",
    lazyImport: "../features/reservations/PaymentFailRoute",
    routeContainer: "PaymentFailRoute",
  },
  {
    publicBarrel: "src/features/reservations/index.ts",
    lazyImport: "../features/reservations/ReservationDetailRoute",
    routeContainer: "ReservationDetailRoute",
  },
  {
    publicBarrel: "src/features/reservations/index.ts",
    lazyImport: "../features/reservations/ReservationConfirmRoute",
    routeContainer: "ReservationConfirmRoute",
  },
  {
    publicBarrel: "src/features/reviews/index.ts",
    lazyImport: "../features/reviews/ReviewCreateRoute",
    routeContainer: "ReviewCreateRoute",
  },
  {
    publicBarrel: "src/features/auth/index.ts",
    lazyImport: "../features/auth/LoginRoute",
    routeContainer: "LoginRoute",
  },
  {
    publicBarrel: "src/features/auth/index.ts",
    lazyImport: "../features/auth/SignupRoute",
    routeContainer: "SignupRoute",
  },
] as const;

const collectLazyImportTargets = (source: string) =>
  Array.from(source.matchAll(/React\.lazy\(\(\)\s*=>\s*import\("([^"]+)"\)/g))
    .map((match) => match[1])
    .filter((target): target is string => Boolean(target));

describe("route boundary contracts", () => {
  it("keeps route shell definitions component-free", () => {
    const definitionSource = readFileSync(
      join(projectRoot, "src/routes/routeDefinitions.ts"),
      "utf8",
    );

    expect(definitionSource).not.toContain("React.lazy");
    expect(definitionSource).not.toMatch(/pages\//);
    expect(definitionSource).not.toMatch(/features\//);
  });

  it("loads route containers from direct per-route feature modules", () => {
    const routeConfigSource = readFileSync(
      join(projectRoot, "src/routes/routeConfig.tsx"),
      "utf8",
    );
    const lazyImportTargets = collectLazyImportTargets(routeConfigSource);

    expect(routeConfigSource).not.toContain("../pages/");
    expect(lazyImportTargets).toHaveLength(featureRouteContainers.length + 1);
    expect(new Set(lazyImportTargets).size).toBe(lazyImportTargets.length);
    featureRouteContainers.forEach(({ lazyImport, routeContainer }) => {
      expect(lazyImportTargets).toContain(lazyImport);
      expect(routeConfigSource).toContain(routeContainer);
    });
    expect(lazyImportTargets).not.toContain("../features/reservations");
    expect(lazyImportTargets).not.toContain("../features/auth");
  });

  it("keeps feature public route barrels from exporting workflow internals", () => {
    featureRouteContainers.forEach(({ publicBarrel, routeContainer }) => {
      const publicBarrelSource = readFileSync(
        join(projectRoot, publicBarrel),
        "utf8",
      );

      expect(publicBarrelSource).toContain(routeContainer);
      expect(publicBarrelSource).not.toMatch(
        /(?:\.\/(?:components|hooks|lib)|Panel|use[A-Z]|REVIEW_IMAGE_UPLOAD_ERROR_MESSAGE)/,
      );
    });
  });
});
