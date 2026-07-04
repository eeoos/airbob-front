import * as fs from "fs";
import * as path from "path";

const productionUiRoots = [
  "pages",
  "components",
  "layouts",
  "features/accommodations/components",
  "features/accommodations/edit/components",
  "features/auth/components",
  "features/reservations/components",
  "features/reviews/components",
  "features/search/components",
  "features/wishlist/components",
  "features/profile/components",
];
const featureRouteContainerFiles = [
  "features/search/SearchRoute.tsx",
  "features/wishlist/WishlistRoute.tsx",
  "features/accommodations/AccommodationDetailRoute.tsx",
  "features/accommodations/edit/AccommodationEditRoute.tsx",
  "features/profile/ProfileRoute.tsx",
];
const productionSourceExtensions = [".ts", ".tsx"];
const directApiImportPattern = /from\s+["'](?:\.\.\/)+(?:api|api\/[^"']*)["']/;
const sourceRoot = path.resolve(__dirname, "..");

const collectProductionUiFiles = (directory: string): string[] => {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectProductionUiFiles(entryPath);
    }

    if (
      !productionSourceExtensions.includes(path.extname(entry.name)) ||
      /\.test\.[tj]sx?$/.test(entry.name)
    ) {
      return [];
    }

    return [entryPath];
  });
};

const collectConfiguredProductionUiFiles = () => [
  ...productionUiRoots.flatMap((root) =>
    collectProductionUiFiles(path.join(sourceRoot, root)),
  ),
  ...featureRouteContainerFiles.map((filePath) =>
    path.join(sourceRoot, filePath),
  ),
];

const toSourceRootRelativePath = (filePath: string) =>
  path.relative(sourceRoot, filePath);

describe("production UI API boundaries", () => {
  it("keeps configured UI API boundary paths present", () => {
    const missingRoots = productionUiRoots.filter(
      (root) => !fs.existsSync(path.join(sourceRoot, root)),
    );
    const missingFiles = featureRouteContainerFiles.filter(
      (filePath) => !fs.existsSync(path.join(sourceRoot, filePath)),
    );

    expect([
      ...missingRoots.map((root) => `root:${root}`),
      ...missingFiles.map((filePath) => `file:${filePath}`),
    ]).toEqual([]);
  });

  it("includes feature route containers in the UI API boundary scan", () => {
    const scannedFiles = collectConfiguredProductionUiFiles().map(
      toSourceRootRelativePath,
    );

    featureRouteContainerFiles.forEach((filePath) => {
      expect(scannedFiles).toContain(filePath);
    });
  });

  it("keeps production UI behind feature hooks instead of direct API imports", () => {
    const violations = collectConfiguredProductionUiFiles()
      .filter((filePath) =>
        directApiImportPattern.test(fs.readFileSync(filePath, "utf8")),
      )
      .map(toSourceRootRelativePath);

    expect(violations).toEqual([]);
  });
});
