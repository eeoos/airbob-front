import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

const componentsRoot = join(process.cwd(), "src/components");
const productionSourceExtensions = [".ts", ".tsx"];
const forbiddenImportPattern =
  /from\s+["'](?:\.\.\/)+(?:api|features|pages)(?:\/[^"']*)?["']/;

const allowedWorkflowFiles = new Set(["Header/Header.tsx", "Header/UserMenu.tsx"]);

const collectProductionSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectProductionSourceFiles(entryPath);
    }

    const isProductionSource =
      productionSourceExtensions.some((extension) =>
        entry.name.endsWith(extension)
      ) &&
      !entry.name.includes(".test.") &&
      !entry.name.endsWith(".d.ts");

    return isProductionSource ? [entryPath] : [];
  });

describe("generic components boundary contracts", () => {
  it("keeps workflow components out of generic components", () => {
    const forbiddenWorkflowDirectories = [
      "Map",
      "ReviewModal",
      "DateChangeModal",
      "GuestChangeModal",
    ];

    const existingForbiddenDirectories = forbiddenWorkflowDirectories.filter(
      (directoryName) => {
        try {
          readdirSync(join(componentsRoot, directoryName));
          return true;
        } catch {
          return false;
        }
      }
    );

    expect(existingForbiddenDirectories).toEqual([]);
  });

  it("keeps generic components independent from app domains", () => {
    const violations = collectProductionSourceFiles(componentsRoot)
      .filter((filePath) => {
        const relativePath = relative(componentsRoot, filePath);

        return !allowedWorkflowFiles.has(relativePath);
      })
      .filter((filePath) =>
        forbiddenImportPattern.test(readFileSync(filePath, "utf8"))
      )
      .map((filePath) => relative(componentsRoot, filePath));

    expect(violations).toEqual([]);
  });
});
