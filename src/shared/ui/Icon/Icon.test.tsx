import { render, screen } from "@testing-library/react";
import { Icon } from "./Icon";
import { defineIconRegistry } from "./iconRegistry";

const dotGlyph = {
  children: <circle cx="12" cy="12" r="4" />,
  fill: "currentColor" as const,
  stroke: "none" as const,
};

const fallbackGlyph = {
  children: <path d="M4 12h16" />,
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 2,
};

describe("Icon", () => {
  it("uses currentColor, an explicit size, and an accessible name", () => {
    render(
      <Icon
        decorative={false}
        glyph={dotGlyph}
        label="현재 위치"
        size={32}
      />
    );

    const icon = screen.getByRole("img", { name: "현재 위치" });

    expect(icon).toHaveAttribute("fill", "currentColor");
    expect(icon).toHaveAttribute("stroke", "none");
    expect(icon).toHaveAttribute("focusable", "false");
    expect(icon).toHaveStyle({ width: "32px", height: "32px" });
  });

  it("keeps decorative icons out of the accessibility tree", () => {
    const { container } = render(
      <Icon decorative glyph={fallbackGlyph} size="100%" />
    );

    // Decorative SVGs intentionally have no semantic role or accessible name.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const icon = container.querySelector("svg");

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).not.toHaveAttribute("aria-label");
    expect(icon).toHaveStyle({ width: "100%", height: "100%" });
  });
});

describe("defineIconRegistry", () => {
  it("resolves known glyphs and uses the declared fallback for unknown input", () => {
    const registry = defineIconRegistry({ DOT: dotGlyph }, fallbackGlyph);
    const resolve = registry.resolve;

    expect(registry.has("DOT")).toBe(true);
    expect(resolve("DOT")).toBe(dotGlyph);
    expect(registry.has("UNKNOWN")).toBe(false);
    expect(resolve("UNKNOWN")).toBe(fallbackGlyph);
    expect(resolve("toString")).toBe(fallbackGlyph);
  });
});
