import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, within } from "@testing-library/react";
import {
  appShellComponents,
  BareShell,
  FormShell,
} from ".";

const appShellIds = [
  "browse",
  "form",
  "transaction",
  "editor",
  "bare",
] as const;

describe("app shells", () => {
  it("exposes one component for every app shell id", () => {
    expect(Object.keys(appShellComponents)).toEqual(appShellIds);
  });

  it.each(appShellIds)(
    "%s owns one main landmark and places its rendered header before it",
    (shellId) => {
      const Shell = appShellComponents[shellId];
      render(
        <Shell header={<header data-testid="app-header">Header</header>}>
          <p>Shell content</p>
        </Shell>
      );

      const main = screen.getByRole("main");
      const header = screen.getByTestId("app-header");

      expect(screen.getAllByRole("main")).toHaveLength(1);
      expect(header).toAppearBefore(main);
      expect(within(main).getByText("Shell content")).toBeInTheDocument();
    }
  );

  it.each([
    ["form", FormShell],
    ["bare", BareShell],
  ] as const)("%s does not render an empty header", (_shellId, Shell) => {
    render(
      <Shell header={null}>
        <p>Headerless content</p>
      </Shell>
    );

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveTextContent("Headerless content");
  });

  it.each(appShellIds)(
    "%s remains the only main owner when page structure is nested inside it",
    (shellId) => {
      const Shell = appShellComponents[shellId];

      render(
        <Shell>
          <section aria-label="예약 상세">
            <p>Page content</p>
          </section>
        </Shell>,
      );

      const main = screen.getByRole("main");

      expect(screen.getAllByRole("main")).toHaveLength(1);
      expect(
        within(main).getByRole("region", { name: "예약 상세" }),
      ).toHaveTextContent("Page content");
    },
  );

  it("preserves the pre-migration layout frame without imposing content width", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/shells/ShellFrame.module.css"),
      "utf8",
    );

    expect(source).toContain(
      "min-height: var(--layout-viewport-height);",
    );
    expect(source).toContain(
      "background-color: var(--color-background-page);",
    );
    expect(source).toMatch(/\.main\s*\{[^}]*width:\s*100%;/s);
    expect(source).not.toContain("max-width");
  });
});
