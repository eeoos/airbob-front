import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

const routesRoot = join(process.cwd(), "src/routes");
const featuresRoot = join(process.cwd(), "src/features");
const projectRoot = process.cwd();
const sourceExtensions = [".ts", ".tsx"];
const forbiddenFeatureImportPattern =
  /from\s+["'](?:\.\.\/)+(?:features)(?:\/[^"']*)?["']/;
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
    forbiddenDeepImportPattern: /features\/wishlist\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/AccommodationDetail/AccommodationDetail.tsx",
    publicImport: "../../features/accommodations",
    routeContainer: "AccommodationDetailRoute",
    forbiddenDeepImportPattern: /features\/accommodations\/(?:components|hooks|lib)\//,
  },
  {
    page: "src/pages/AccommodationEdit/AccommodationEdit.tsx",
    publicImport: "../../features/accommodations/edit",
    routeContainer: "AccommodationEditRoute",
    forbiddenDeepImportPattern:
      /features\/accommodations\/edit\/(?:components|hooks|lib)\//,
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
        forbiddenFeatureImportPattern.test(readFileSync(filePath, "utf8"))
      )
      .map((filePath) => relative(projectRoot, filePath));

    expect(violations).toEqual([]);
  });

  it("keeps feature modules from importing page modules", () => {
    const violations = collectSourceFiles(featuresRoot)
      .filter((filePath) =>
        forbiddenPageImportPattern.test(readFileSync(filePath, "utf8"))
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
      }
    );
  });

  it("keeps feature public route barrels from exporting workflow internals", () => {
    featureRouteAdapters.forEach(({ publicImport, routeContainer }) => {
      const publicBarrelPath = `${publicImport.replace(
        /^\.\.\/\.\.\//,
        "src/"
      )}/index.ts`;
      const publicBarrel = readFileSync(
        join(projectRoot, publicBarrelPath),
        "utf8"
      );

      expect(publicBarrel).toContain(routeContainer);
      expect(publicBarrel).not.toMatch(/\.\/(?:components|hooks|lib)/);
    });
  });
});
