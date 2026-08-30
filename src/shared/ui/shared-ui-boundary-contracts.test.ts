import { readFileSync } from "fs";
import { join } from "path";

const srcRoot = join(process.cwd(), "src");
const sharedUiImportPattern =
  /^[ \t]*import\s+\{([^{}]*?)\}\s+from\s+["'][^"']*shared\/ui["'];?/gm;

const collectSharedUiNamedImports = (source: string) =>
  Array.from(source.matchAll(sharedUiImportPattern)).flatMap((match) =>
    match[1]
      .split(",")
      .map((importName) => importName.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean)
  );

const usesJsxTag = (source: string, componentName: string) =>
  new RegExp(`<${componentName}(?:\\s|>|/)`).test(source);

describe("shared UI boundary contracts", () => {
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

  it("owns date picking in shared UI while retaining a thin compatibility facade", () => {
    const datePickerSource = readFileSync(
      join(srcRoot, "shared/ui/DatePicker/DatePicker.tsx"),
      "utf8",
    );
    const datePickerCompatibilitySource = readFileSync(
      join(srcRoot, "components/DatePicker/DatePicker.tsx"),
      "utf8",
    );
    const errorToastSource = readFileSync(
      join(srcRoot, "components/ErrorToast/ErrorToast.tsx"),
      "utf8",
    );

    expect(datePickerSource).toContain("const DatePicker");
    expect(datePickerSource).toContain("renderCalendar");
    expect(datePickerCompatibilitySource).toContain(
      'from "../../shared/ui/DatePicker"',
    );
    expect(datePickerCompatibilitySource).not.toContain("renderCalendar");
    expect(errorToastSource).toContain("ToastHost");
    expect(errorToastSource).toContain('from "../../shared/ui"');
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
        expected: ["Button", "Dialog"],
      },
      {
        relativePath: "features/auth/ui/AuthFormFields.tsx",
        expected: ["TextField"],
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
      const sharedUiImports = new Set(collectSharedUiNamedImports(source));

      return expected.flatMap((primitive) => {
        const primitiveViolations: string[] = [];

        if (!sharedUiImports.has(primitive)) {
          primitiveViolations.push(
            `${relativePath}: missing ${primitive} import from shared/ui`,
          );
        }

        if (!usesJsxTag(source, primitive)) {
          primitiveViolations.push(
            `${relativePath}: missing <${primitive}> JSX usage`,
          );
        }

        return primitiveViolations;
      });
    });

    expect(violations).toEqual([]);
  });

  it("does not satisfy primitive contracts from incidental substrings", () => {
    const source = `
      import styles from "./Example.module.css";
      const submitButton = styles.submitButton;
      export const Example = () => <button className={submitButton}>Save</button>;
    `;

    expect(collectSharedUiNamedImports(source)).toEqual([]);
    expect(usesJsxTag(source, "Button")).toBe(false);
  });
});
