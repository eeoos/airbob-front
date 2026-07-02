import * as fs from "fs";
import * as path from "path";

const productionUiRoots = ["pages", "components"];
const productionSourceExtensions = [".ts", ".tsx"];
const directApiImportPattern =
  /from\s+["'](?:\.\.\/)+(?:api|api\/[^"']*)["']/;

const collectProductionUiFiles = (directory: string): string[] => {
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

describe("production UI API boundaries", () => {
  it("keeps pages and components behind feature hooks instead of direct API imports", () => {
    const sourceRoot = path.resolve(__dirname, "..");
    const violations = productionUiRoots.flatMap((root) =>
      collectProductionUiFiles(path.join(sourceRoot, root))
        .filter((filePath) =>
          directApiImportPattern.test(fs.readFileSync(filePath, "utf8"))
        )
        .map((filePath) => path.relative(sourceRoot, filePath))
    );

    expect(violations).toEqual([]);
  });
});
