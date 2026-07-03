import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

const sharedUiRoot = join(process.cwd(), "src/shared/ui");
const srcRoot = join(process.cwd(), "src");
const productionSourceExtensions = [".ts", ".tsx"];
const forbiddenBoundaryImportPattern =
  /from\s+["'](?:\.\.\/)+(?:api|features|pages|routes|types)(?:\/[^"']*)?["']/;

const collectProductionSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectProductionSourceFiles(entryPath);
    }

    const isProductionSource =
      productionSourceExtensions.some((extension) => entry.name.endsWith(extension)) &&
      !entry.name.includes(".test.") &&
      !entry.name.endsWith(".d.ts");

    return isProductionSource ? [entryPath] : [];
  });

describe("shared UI boundary contracts", () => {
  it("keeps shared UI primitives independent from app domains", () => {
    const violations = collectProductionSourceFiles(sharedUiRoot)
      .filter((filePath) =>
        forbiddenBoundaryImportPattern.test(readFileSync(filePath, "utf8"))
      )
      .map((filePath) => relative(process.cwd(), filePath));

    expect(violations).toEqual([]);
  });

  it("keeps design-entry modals on the shared Dialog scroll-lock boundary", () => {
    const dialogOwnedModalFiles = [
      "features/auth/components/AuthModal/AuthModal.tsx",
      "features/reservations/components/ReservationModal/ReservationModal.tsx",
    ];

    const violations = dialogOwnedModalFiles.flatMap((relativePath) => {
      const source = readFileSync(join(srcRoot, relativePath), "utf8");
      const fileViolations: string[] = [];

      if (!source.includes("<Dialog")) {
        fileViolations.push(`${relativePath}: missing <Dialog boundary`);
      }

      if (source.includes("document.body.style.overflow")) {
        fileViolations.push(`${relativePath}: owns body scroll lock`);
      }

      return fileViolations;
    });

    expect(violations).toEqual([]);
  });
});
