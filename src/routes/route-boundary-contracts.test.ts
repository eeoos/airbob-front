import { readFileSync, readdirSync } from "fs";
import { dirname, join, relative, resolve } from "path";

const routesRoot = join(process.cwd(), "src/routes");
const routePathsFile = join(routesRoot, "paths.ts");
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
const allowedRouteFeatureImportPatterns = [
  /from\s+["']\.\.\/features\/search\/lib\/searchRouteQuery["']/g,
  /from\s+["']\.\.\/features\/wishlist\/lib\/wishlistRouteQuery["']/g,
  /from\s+["']\.\.\/features\/profile\/lib\/profileRouteQuery["']/g,
  /from\s+["']\.\.\/features\/reservations\/lib\/paymentRouteState["']/g,
];
const forbiddenLayoutFeatureDeepImportPattern =
  /from\s+["'](?:\.\.\/)+(?:features\/[^"']+\/(?:components|hooks|lib))(?:\/[^"']*)?["']/;
const forbiddenPageImportPattern =
  /from\s+["'](?:\.\.\/)+pages(?:\/[^"']*)?["']/;
const featureRouteAdapters = [
  {
    page: "src/pages/Home/Home.tsx",
    publicImport: "../../features/home",
    routeContainer: "HomeRoute",
    forbiddenDeepImportPattern: /features\/home\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/Search/Search.tsx",
    publicImport: "../../features/search",
    routeContainer: "SearchRoute",
    forbiddenDeepImportPattern: /features\/search\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/Wishlist/Wishlist.tsx",
    publicImport: "../../features/wishlist",
    routeContainer: "WishlistRoute",
    forbiddenDeepImportPattern:
      /features\/wishlist\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/AccommodationDetail/AccommodationDetail.tsx",
    publicImport: "../../features/accommodations",
    routeContainer: "AccommodationDetailRoute",
    forbiddenDeepImportPattern:
      /features\/accommodations\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/AccommodationEdit/AccommodationEdit.tsx",
    publicImport: "../../features/accommodations/edit",
    routeContainer: "AccommodationEditRoute",
    forbiddenDeepImportPattern:
      /features\/accommodations\/edit\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/Profile/Profile.tsx",
    publicImport: "../../features/profile",
    routeContainer: "ProfileRoute",
    forbiddenDeepImportPattern: /features\/profile\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx",
    publicImport: "../../../features/reservations",
    routeContainer: "HostReservationDetailRoute",
    forbiddenDeepImportPattern:
      /features\/reservations\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/Reservations/PaymentSuccess.tsx",
    publicImport: "../../features/reservations",
    routeContainer: "PaymentSuccessRoute",
    forbiddenDeepImportPattern:
      /features\/reservations\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/Reservations/PaymentFail.tsx",
    publicImport: "../../features/reservations",
    routeContainer: "PaymentFailRoute",
    forbiddenDeepImportPattern:
      /features\/reservations\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/Reservations/ReservationDetail.tsx",
    publicImport: "../../features/reservations",
    routeContainer: "ReservationDetailRoute",
    forbiddenDeepImportPattern:
      /features\/reservations\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/Reservations/ReservationConfirm.tsx",
    publicImport: "../../features/reservations",
    routeContainer: "ReservationConfirmRoute",
    forbiddenDeepImportPattern:
      /features\/reservations\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/Reservations/ReviewCreate.tsx",
    publicImport: "../../features/reviews",
    routeContainer: "ReviewCreateRoute",
    forbiddenDeepImportPattern: /features\/reviews\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/Auth/Login/Login.tsx",
    publicImport: "../../../features/auth",
    routeContainer: "LoginRoute",
    forbiddenDeepImportPattern: /features\/auth\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/Auth/Signup/Signup.tsx",
    publicImport: "../../../features/auth",
    routeContainer: "SignupRoute",
    forbiddenDeepImportPattern: /features\/auth\/(?:components|hooks|lib)\//,
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
  it("keeps route URL contracts limited to domain route query ownership", () => {
    const violations = collectSourceFiles(routesRoot)
      .filter((filePath) => {
        const source = readFileSync(filePath, "utf8");
        const sourceWithoutAllowedImports =
          filePath === routePathsFile
            ? allowedRouteFeatureImportPatterns.reduce(
                (nextSource, allowedPattern) =>
                  nextSource.replace(allowedPattern, ""),
                source,
              )
            : source;

        return forbiddenFeatureImportPattern.test(sourceWithoutAllowedImports);
      })
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

  it("keeps page route adapters pointed at feature route containers", () => {
    featureRouteAdapters.forEach(
      ({ page, publicImport, routeContainer, forbiddenDeepImportPattern }) => {
        const source = readFileSync(join(projectRoot, page), "utf8");

        expect(source).toContain(publicImport);
        expect(source).toContain(routeContainer);
        expect(source).not.toMatch(forbiddenDeepImportPattern);
      },
    );
  });

  it("keeps profile and reservations page adapters out of feature internals", () => {
    [
      "src/pages/Profile/Profile.tsx",
      "src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx",
      "src/pages/Reservations/PaymentSuccess.tsx",
      "src/pages/Reservations/PaymentFail.tsx",
      "src/pages/Reservations/ReservationDetail.tsx",
      "src/pages/Reservations/ReservationConfirm.tsx",
      "src/pages/Reservations/ReviewCreate.tsx",
    ].forEach((pagePath) => {
      const source = readFileSync(join(process.cwd(), pagePath), "utf8");

      expect(source).not.toMatch(
        /features\/(?:profile|reservations|reviews)\/(?:hooks|lib|components)\//,
      );
    });
  });

  it("keeps Profile page as a thin adapter to the profile feature route", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "src/pages/Profile/Profile.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("../../features/profile");
    expect(pageSource).toContain("ProfileRoute");
    expect(pageSource).not.toMatch(
      /\.\/GuestTrips|\.\/HostListings|\.\/HostReservations/,
    );
    expect(pageSource).not.toContain("getActiveTabFromRouteTab");
    expect(pageSource).not.toContain("useState");
  });

  it("keeps HostReservationDetail page as an adapter to the reservations feature route", () => {
    const pageSource = readFileSync(
      join(
        process.cwd(),
        "src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx",
      ),
      "utf8",
    );

    expect(pageSource).toContain("../../../features/reservations");
    expect(pageSource).toContain("HostReservationDetailRoute");
    expect(pageSource).not.toContain("useHostReservationDetail");
    expect(pageSource).not.toContain("formatReservationStatus");
  });

  it("keeps payment callback pages as adapters to reservation feature routes", () => {
    const successSource = readFileSync(
      join(process.cwd(), "src/pages/Reservations/PaymentSuccess.tsx"),
      "utf8",
    );
    const failSource = readFileSync(
      join(process.cwd(), "src/pages/Reservations/PaymentFail.tsx"),
      "utf8",
    );

    expect(successSource).toContain("../../features/reservations");
    expect(successSource).toContain("PaymentSuccessRoute");
    expect(successSource).not.toContain("usePaymentConfirmation");
    expect(failSource).toContain("../../features/reservations");
    expect(failSource).toContain("PaymentFailRoute");
    expect(failSource).not.toContain(
      "clearReservationCheckoutStateByReservationUid",
    );
  });

  it("keeps ReviewCreate page as an adapter to the reviews feature route", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "src/pages/Reservations/ReviewCreate.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("../../features/reviews");
    expect(pageSource).toContain("ReviewCreateRoute");
    expect(pageSource).not.toContain("useReviewCreate");
    expect(pageSource).not.toContain("useState");
  });

  it("keeps Home page as a thin adapter to the home feature route", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "src/pages/Home/Home.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("../../features/home");
    expect(pageSource).toContain("HomeRoute");
    expect(pageSource).not.toMatch(/\.\/Home\.module\.css|styles\./);
    expect(pageSource).not.toContain("<div");
    expect(pageSource).not.toContain("<h1");
    expect(pageSource).not.toContain("<p");
  });

  it("keeps feature public route barrels from exporting workflow internals", () => {
    featureRouteAdapters.forEach(({ publicImport, routeContainer }) => {
      const publicBarrelPath =
        `${publicImport.replace(/^(?:\.\.\/)+/, "src/")}/index.ts`;
      const publicBarrel = readFileSync(
        join(projectRoot, publicBarrelPath),
        "utf8",
      );

      expect(publicBarrel).toContain(routeContainer);
      expect(publicBarrel).not.toMatch(
        /(?:\.\/(?:components|hooks|lib)|Panel|use[A-Z]|REVIEW_IMAGE_UPLOAD_ERROR_MESSAGE)/,
      );
    });
  });
});
