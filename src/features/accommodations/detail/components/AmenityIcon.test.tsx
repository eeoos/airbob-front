import { render, screen } from "@testing-library/react";
import { accommodationAmenityCatalog } from "../../public";
import AmenityIcon from "./AmenityIcon";
import { accommodationAmenityIconRegistry } from "./amenityIconRegistry";

describe("AmenityIcon", () => {
  it("keeps a context-specific detail glyph for every parent catalog code", () => {
    expect(Object.keys(accommodationAmenityIconRegistry.glyphs).sort()).toEqual(
      accommodationAmenityCatalog.knownAmenities.map(({ code }) => code).sort(),
    );
  });

  it("uses the provided amenity label as its accessible name", () => {
    render(<AmenityIcon type="WIFI" label="무선 인터넷" />);

    const icon = screen.getByRole("img", { name: "무선 인터넷" });

    expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
    expect(icon).toHaveAttribute("stroke", "currentColor");
    expect(icon).toHaveStyle({ width: "24px", height: "24px" });
    expect(screen.queryByRole("img", { name: "WIFI" })).not.toBeInTheDocument();
  });

  it("renders amenity pictograms with the shared rounded outline treatment", () => {
    render(<AmenityIcon type="HEATING" />);

    const icon = screen.getByRole("img", { name: "HEATING" });

    expect(icon).toHaveAttribute("fill", "none");
    expect(icon).toHaveAttribute("stroke", "currentColor");
    expect(icon).toHaveAttribute("stroke-linecap", "round");
    expect(icon).toHaveAttribute("stroke-linejoin", "round");
  });

  it.each([
    ["SMOKE_ALARM", "CARBON_MONOXIDE_ALARM"],
    ["SMOKE_ALARM", "UNKNOWN_AMENITY"],
    ["CARBON_MONOXIDE_ALARM", "UNKNOWN_AMENITY"],
    ["WASHER", "DRYER"],
    ["POOL", "HOT_TUB"],
    ["BED_LINENS", "EXTRA_PILLOWS"],
  ])("keeps %s visually distinct from %s", (firstType, secondType) => {
    const { rerender } = render(
      <AmenityIcon type={firstType} label={firstType} />,
    );
    const firstMarkup = screen.getByRole("img", { name: firstType }).innerHTML;

    rerender(<AmenityIcon type={secondType} label={secondType} />);

    expect(screen.getByRole("img", { name: secondType }).innerHTML).not.toBe(
      firstMarkup,
    );
  });

  it("renders the fallback icon for unknown amenity types", () => {
    render(<AmenityIcon type="UNKNOWN_AMENITY" />);

    const icon = screen.getByRole("img", { name: "UNKNOWN_AMENITY" });

    expect(icon).toHaveAttribute("stroke", "currentColor");
    expect(icon).toHaveAttribute("fill", "none");
    expect(accommodationAmenityIconRegistry.resolve("UNKNOWN_AMENITY")).toBe(
      accommodationAmenityIconRegistry.fallback,
    );
  });

  it("hides decorative usage from assistive technology", () => {
    const { container } = render(<AmenityIcon type="WIFI" decorative />);
    // Decorative SVGs are intentionally hidden from accessibility queries.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const icon = container.querySelector("svg");

    expect(screen.queryByRole("img", { name: "WIFI" })).not.toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("focusable", "false");
    expect(icon).not.toHaveAttribute("aria-label");
  });
});
