import { readFileSync, readdirSync } from "fs";
import { dirname, join, relative, resolve } from "path";

const routesRoot = join(process.cwd(), "src/routes");
const layoutsRoot = join(process.cwd(), "src/layouts");
const featuresRoot = join(process.cwd(), "src/features");
const searchFeatureRoot = join(featuresRoot, "search");
const wishlistFeatureRoot = join(featuresRoot, "wishlist");
const projectRoot = process.cwd();
const sourceExtensions = [".ts", ".tsx"];
const importDeclarationPattern =
  /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
const forbiddenFeatureImportPattern =
  /from\s+["'](?:\.\.\/)+(?:features)(?:\/[^"']*)?["']/;
const forbiddenLayoutFeatureDeepImportPattern =
  /from\s+["'](?:\.\.\/)+(?:features\/[^"']+\/(?:components|hooks|lib))(?:\/[^"']*)?["']/;
const forbiddenPageImportPattern =
  /from\s+["'](?:\.\.\/)+pages(?:\/[^"']*)?["']/;
const featureRouteContainers = [
  {
    publicBarrel: "src/features/home/index.ts",
    lazyImport: "../features/home",
    routeContainer: "HomeRoute",
  },
  {
    publicBarrel: "src/features/search/index.ts",
    lazyImport: "../features/search",
    routeContainer: "SearchRoute",
  },
  {
    publicBarrel: "src/features/wishlist/index.ts",
    lazyImport: "../features/wishlist",
    routeContainer: "WishlistRoute",
  },
  {
    publicBarrel: "src/features/accommodations/index.ts",
    lazyImport: "../features/accommodations",
    routeContainer: "AccommodationDetailRoute",
  },
  {
    publicBarrel: "src/features/accommodations/edit/index.ts",
    lazyImport: "../features/accommodations/edit",
    routeContainer: "AccommodationEditRoute",
  },
  {
    publicBarrel: "src/features/profile/index.ts",
    lazyImport: "../features/profile",
    routeContainer: "ProfileRoute",
  },
  {
    publicBarrel: "src/features/reservations/index.ts",
    lazyImport: "../features/reservations",
    routeContainer: "HostReservationDetailRoute",
  },
  {
    publicBarrel: "src/features/reservations/index.ts",
    lazyImport: "../features/reservations",
    routeContainer: "PaymentSuccessRoute",
  },
  {
    publicBarrel: "src/features/reservations/index.ts",
    lazyImport: "../features/reservations",
    routeContainer: "PaymentFailRoute",
  },
  {
    publicBarrel: "src/features/reservations/index.ts",
    lazyImport: "../features/reservations",
    routeContainer: "ReservationDetailRoute",
  },
  {
    publicBarrel: "src/features/reservations/index.ts",
    lazyImport: "../features/reservations",
    routeContainer: "ReservationConfirmRoute",
  },
  {
    publicBarrel: "src/features/reviews/index.ts",
    lazyImport: "../features/reviews",
    routeContainer: "ReviewCreateRoute",
  },
  {
    publicBarrel: "src/features/auth/index.ts",
    lazyImport: "../features/auth",
    routeContainer: "LoginRoute",
  },
  {
    publicBarrel: "src/features/auth/index.ts",
    lazyImport: "../features/auth",
    routeContainer: "SignupRoute",
  },
] as const;

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }

    const isSource =
      sourceExtensions.some((extension) => entry.name.endsWith(extension)) &&
      !entry.name.includes(".test.") &&
      !entry.name.endsWith(".d.ts");

    return isSource ? [entryPath] : [];
  });

const toProjectRelativeImportTarget = (
  filePath: string,
  importSource: string,
) => {
  if (!importSource.startsWith(".")) {
    return null;
  }

  return relative(
    projectRoot,
    resolve(dirname(filePath), importSource),
  ).replace(/\\/g, "/");
};

const importsPrivateFeatureSurface = (
  importTarget: string,
  targetFeature: "search" | "wishlist",
) => {
  const targetFeatureRoot = `src/features/${targetFeature}`;
  const privateSurfaceRoots = ["lib", "hooks", "components"].map(
    (surface) => `${targetFeatureRoot}/${surface}`,
  );

  return (
    privateSurfaceRoots.some(
      (surfaceRoot) =>
        importTarget === surfaceRoot ||
        importTarget.startsWith(`${surfaceRoot}/`),
    ) ||
    importTarget === `${targetFeatureRoot}/queryKeys` ||
    importTarget.startsWith(`${targetFeatureRoot}/queryKeys.`)
  );
};

const collectPrivateCrossFeatureImports = (
  sourceRoot: string,
  targetFeature: "search" | "wishlist",
) =>
  collectSourceFiles(sourceRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8");

    return Array.from(source.matchAll(importDeclarationPattern))
      .map((match) => match[1])
      .filter((importSource): importSource is string => Boolean(importSource))
      .map((importSource) => ({
        importSource,
        importTarget: toProjectRelativeImportTarget(filePath, importSource),
      }))
      .filter(
        ({ importTarget }) =>
          importTarget !== null &&
          importsPrivateFeatureSurface(importTarget, targetFeature),
      )
      .map(
        ({ importSource }) =>
          `${relative(projectRoot, filePath)} imports ${importSource}`,
      );
  });

describe("route boundary contracts", () => {
  it("keeps route files from importing feature modules", () => {
    const violations = collectSourceFiles(routesRoot)
      .filter(
        (filePath) =>
          relative(projectRoot, filePath) !== "src/routes/routeConfig.tsx",
      )
      .filter((filePath) =>
        forbiddenFeatureImportPattern.test(readFileSync(filePath, "utf8")),
      )
      .map((filePath) => relative(projectRoot, filePath));

    expect(violations).toEqual([]);
  });

  it("keeps route shell definitions component-free", () => {
    const definitionSource = readFileSync(
      join(process.cwd(), "src/routes/routeDefinitions.ts"),
      "utf8",
    );

    expect(definitionSource).not.toContain("React.lazy");
    expect(definitionSource).not.toMatch(/pages\//);
    expect(definitionSource).not.toMatch(/features\//);
  });

  it("keeps feature modules from importing page modules", () => {
    const violations = collectSourceFiles(featuresRoot)
      .filter((filePath) =>
        forbiddenPageImportPattern.test(readFileSync(filePath, "utf8")),
      )
      .map((filePath) => relative(projectRoot, filePath));

    expect(violations).toEqual([]);
  });

  it("keeps search and wishlist cross-feature cache access on public boundaries", () => {
    const violations = [
      ...collectPrivateCrossFeatureImports(searchFeatureRoot, "wishlist"),
      ...collectPrivateCrossFeatureImports(wishlistFeatureRoot, "search"),
    ];

    expect(violations).toEqual([]);
  });

  it("keeps cross-feature profile composition on reservation app-shell APIs", () => {
    const profileRouteSource = readFileSync(
      join(process.cwd(), "src/features/profile/ProfileRoute.tsx"),
      "utf8",
    );

    expect(profileRouteSource).toContain("../reservations/appShell");
    expect(profileRouteSource).not.toMatch(
      /from\s+["']\.\.\/reservations\/(?:GuestTripsPanel|HostReservationsPanel)["']/,
    );
  });

  it("treats cross-feature private barrel roots as boundary violations", () => {
    expect(
      importsPrivateFeatureSurface("src/features/wishlist/hooks", "wishlist"),
    ).toBe(true);
    expect(
      importsPrivateFeatureSurface(
        "src/features/wishlist/components",
        "wishlist",
      ),
    ).toBe(true);
    expect(
      importsPrivateFeatureSurface("src/features/wishlist/lib", "wishlist"),
    ).toBe(true);
  });

  it("keeps layouts on explicit feature app-shell APIs", () => {
    const violations = collectSourceFiles(layoutsRoot)
      .filter((filePath) =>
        forbiddenLayoutFeatureDeepImportPattern.test(
          readFileSync(filePath, "utf8"),
        ),
      )
      .map((filePath) => relative(projectRoot, filePath));

    expect(violations).toEqual([]);
  });

  it("loads route containers from feature public barrels directly", () => {
    const routeConfigSource = readFileSync(
      join(projectRoot, "src/routes/routeConfig.tsx"),
      "utf8",
    );

    expect(routeConfigSource).not.toContain("../pages/");
    featureRouteContainers.forEach(({ lazyImport, routeContainer }) => {
      expect(routeConfigSource).toContain(lazyImport);
      expect(routeConfigSource).toContain(routeContainer);
    });
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
