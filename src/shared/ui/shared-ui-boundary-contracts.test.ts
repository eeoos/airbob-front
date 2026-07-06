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

  it("keeps design-entry modals on the shared Dialog primitive", () => {
    const dialogOwnedModalFiles = [
      "features/auth/components/AuthModal/AuthModal.tsx",
      "features/reservations/components/ReservationModal/ReservationModal.tsx",
      "features/reviews/components/ReviewModal/ReviewModal.tsx",
      "features/accommodations/components/AccommodationActionModal/AccommodationActionModal.tsx",
    ];

    const violations = dialogOwnedModalFiles.flatMap((relativePath) => {
      const source = readFileSync(join(srcRoot, relativePath), "utf8");
      const fileViolations: string[] = [];

      if (!source.includes("<Dialog")) {
        fileViolations.push(`${relativePath}: missing shared Dialog primitive`);
      }

      if (source.includes("useBodyScrollLock(")) {
        fileViolations.push(`${relativePath}: owns scroll-lock hook directly`);
      }

      if (source.includes("document.body.style.overflow")) {
        fileViolations.push(`${relativePath}: owns body scroll lock`);
      }

      return fileViolations;
    });

    expect(violations).toEqual([]);
  });

  it("records src/components carve-outs for date picking and toast compatibility", () => {
    const datePickerSource = readFileSync(
      join(srcRoot, "components/DatePicker/DatePicker.tsx"),
      "utf8"
    );
    const errorToastSource = readFileSync(
      join(srcRoot, "components/ErrorToast/ErrorToast.tsx"),
      "utf8"
    );

    expect(datePickerSource).toContain("const DatePicker");
    expect(datePickerSource).toContain("renderCalendar");
    expect(errorToastSource).toContain("ToastHost");
    expect(errorToastSource).toContain('from "../../shared/ui"');
  });

  it("keeps shared status and toast styles on design tokens", () => {
    const sharedStyleFiles = [
      "shared/ui/ListingCard/ListingCard.module.css",
      "shared/ui/OverlaySurface/OverlaySurface.module.css",
      "shared/ui/PageShell/PageShell.module.css",
      "shared/ui/StatusBadge/StatusBadge.module.css",
      "shared/ui/ToastHost/ToastHost.module.css",
    ];

    const violations = sharedStyleFiles.flatMap((relativePath) => {
      const source = readFileSync(join(srcRoot, relativePath), "utf8");
      return /#[0-9a-fA-F]{3,8}\b/.test(source) ? [relativePath] : [];
    });

    expect(violations).toEqual([]);
  });

  it("keeps ErrorToast as a thin wrapper without a dead local stylesheet", () => {
    const errorToastStylePath = join(
      srcRoot,
      "components/ErrorToast/ErrorToast.module.css"
    );

    expect(() => readFileSync(errorToastStylePath, "utf8")).toThrow();
  });

  it("keeps direct-fit task 5 surfaces on shared form and action primitives", () => {
    const primitiveContracts = [
      {
        relativePath: "features/auth/components/AuthModal/AuthModal.tsx",
        expected: ["Button", "Dialog", "TextField"],
      },
      {
        relativePath:
          "features/reservations/components/ReservationModal/ReservationModal.tsx",
        expected: ["Button", "Dialog"],
      },
      {
        relativePath: "features/wishlist/components/WishlistModal/WishlistModal.tsx",
        expected: ["Button", "Dialog"],
      },
      {
        relativePath:
          "features/accommodations/components/AccommodationActionModal/AccommodationActionModal.tsx",
        expected: ["Button", "Dialog"],
      },
      {
        relativePath: "features/reservations/PaymentFailRoute.tsx",
        expected: ["Button"],
      },
      {
        relativePath: "components/ErrorBoundary/ErrorBoundary.tsx",
        expected: ["Button"],
      },
    ];

    const violations = primitiveContracts.flatMap(({ relativePath, expected }) => {
      const source = readFileSync(join(srcRoot, relativePath), "utf8");

      return expected.flatMap((primitive) =>
        source.includes(primitive)
          ? []
          : [`${relativePath}: missing ${primitive}`],
      );
    });

    expect(violations).toEqual([]);
  });
});
