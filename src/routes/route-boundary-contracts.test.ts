import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

const routesRoot = join(process.cwd(), "src/routes");
const layoutsRoot = join(process.cwd(), "src/layouts");
const featuresRoot = join(process.cwd(), "src/features");
const projectRoot = process.cwd();
const sourceExtensions = [".ts", ".tsx"];
const forbiddenFeatureImportPattern =
  /from\s+["'](?:\.\.\/)+(?:features)(?:\/[^"']*)?["']/;
const forbiddenLayoutFeatureDeepImportPattern =
  /from\s+["'](?:\.\.\/)+(?:features\/[^"']+\/(?:components|hooks|lib))(?:\/[^"']*)?["']/;
const forbiddenPageImportPattern =
  /from\s+["'](?:\.\.\/)+pages(?:\/[^"']*)?["']/;
const featureRouteAdapters = [
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

describe("route boundary contracts", () => {
  it("keeps route URL contracts independent from feature internals", () => {
    const violations = collectSourceFiles(routesRoot)
      .filter((filePath) =>
        forbiddenFeatureImportPattern.test(readFileSync(filePath, "utf8")),
      )
      .map((filePath) => relative(projectRoot, filePath));

    expect(violations).toEqual([]);
  });

  it("keeps feature modules from importing page modules", () => {
    const violations = collectSourceFiles(featuresRoot)
      .filter((filePath) =>
        forbiddenPageImportPattern.test(readFileSync(filePath, "utf8")),
      )
      .map((filePath) => relative(projectRoot, filePath));

    expect(violations).toEqual([]);
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

  it("keeps feature public route barrels from exporting workflow internals", () => {
    featureRouteAdapters.forEach(({ publicImport, routeContainer }) => {
      const publicBarrelPath = `${publicImport.replace(
        /^(?:\.\.\/)+/,
        "src/",
      )}/index.ts`;
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
