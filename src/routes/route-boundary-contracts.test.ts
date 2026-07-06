import { readFileSync, readdirSync } from "fs";
import { dirname, join, relative, resolve } from "path";

const routesRoot = join(process.cwd(), "src/routes");
const layoutsRoot = join(process.cwd(), "src/layouts");
const featuresRoot = join(process.cwd(), "src/features");
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

const publicFeatureSurfaceFiles = new Set(["appShell", "publicCache"]);
const privateFeatureSegments = new Set(["components", "hooks", "lib"]);

const getFeatureIdentity = (sourceRootRelativePath: string) => {
  const accommodationEditMatch = sourceRootRelativePath.match(
    /^src\/features\/accommodations\/edit(?:\/(.+))?$/,
  );

  if (accommodationEditMatch) {
    return {
      featureName: "accommodations/edit",
      rest: accommodationEditMatch[1] ?? "",
    };
  }

  const match = sourceRootRelativePath.match(
    /^src\/features\/([^/]+)(?:\/(.+))?$/,
  );

  if (!match) {
    return null;
  }

  return {
    featureName: match[1],
    rest: match[2] ?? "",
  };
};

const getFeatureName = (sourceRootRelativePath: string) =>
  getFeatureIdentity(sourceRootRelativePath)?.featureName ?? null;

const getImportedFeatureSurface = (importTarget: string) => {
  const identity = getFeatureIdentity(importTarget);

  if (!identity) {
    return null;
  }

  const { featureName, rest } = identity;
  const [firstSegment = "index"] = rest ? rest.split("/") : ["index"];
  const basename = firstSegment.replace(/\.[tj]sx?$/, "");

  return {
    featureName,
    firstSegment,
    basename,
  };
};

const importsPrivateCrossFeatureSurface = (
  importerPath: string,
  importTarget: string,
) => {
  const importerFeature = getFeatureName(importerPath);
  const imported = getImportedFeatureSurface(importTarget);

  if (!importerFeature || !imported || importerFeature === imported.featureName) {
    return false;
  }

  if (publicFeatureSurfaceFiles.has(imported.basename)) {
    return false;
  }

  if (imported.basename === "index") {
    return true;
  }

  if (privateFeatureSegments.has(imported.firstSegment)) {
    return true;
  }

  return imported.firstSegment === "queryKeys";
};

const collectPrivateCrossFeatureImports = () =>
  collectSourceFiles(featuresRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8");
    const importerPath = relative(projectRoot, filePath).replace(/\\/g, "/");

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
          importsPrivateCrossFeatureSurface(importerPath, importTarget),
      )
      .map(
        ({ importSource, importTarget }) =>
          `${importerPath} imports ${importSource} (${importTarget})`,
      );
  });

const collectLazyImportTargets = (source: string) =>
  Array.from(source.matchAll(/React\.lazy\(\(\)\s*=>\s*import\("([^"]+)"\)/g))
    .map((match) => match[1])
    .filter((target): target is string => Boolean(target));

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

  it("keeps feature-to-feature imports on public feature surfaces", () => {
    expect(collectPrivateCrossFeatureImports()).toEqual([]);
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
      importsPrivateCrossFeatureSurface(
        "src/features/search/index.ts",
        "src/features/wishlist",
      ),
    ).toBe(true);
    expect(
      importsPrivateCrossFeatureSurface(
        "src/features/search/index.ts",
        "src/features/wishlist/index",
      ),
    ).toBe(true);
    expect(
      importsPrivateCrossFeatureSurface(
        "src/features/search/index.ts",
        "src/features/wishlist/appShell",
      ),
    ).toBe(false);
    expect(
      importsPrivateCrossFeatureSurface(
        "src/features/search/index.ts",
        "src/features/wishlist/publicCache",
      ),
    ).toBe(false);
    expect(
      importsPrivateCrossFeatureSurface(
        "src/features/search/index.ts",
        "src/features/wishlist/hooks",
      ),
    ).toBe(true);
    expect(
      importsPrivateCrossFeatureSurface(
        "src/features/search/index.ts",
        "src/features/wishlist/components",
      ),
    ).toBe(true);
    expect(
      importsPrivateCrossFeatureSurface(
        "src/features/search/index.ts",
        "src/features/wishlist/lib",
      ),
    ).toBe(true);
    expect(
      importsPrivateCrossFeatureSurface(
        "src/features/accommodations/edit/AccommodationEditRoute.tsx",
        "src/features/accommodations/hooks",
      ),
    ).toBe(true);
    expect(
      importsPrivateCrossFeatureSurface(
        "src/features/accommodations/AccommodationDetailRoute.tsx",
        "src/features/accommodations/edit/hooks",
      ),
    ).toBe(true);
    expect(
      importsPrivateCrossFeatureSurface(
        "src/features/accommodations/edit/AccommodationEditRoute.tsx",
        "src/features/accommodations/edit/hooks",
      ),
    ).toBe(false);
    expect(
      importsPrivateCrossFeatureSurface(
        "src/features/accommodations/edit/AccommodationEditRoute.tsx",
        "src/features/accommodations/edit",
      ),
    ).toBe(false);
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
