import { render, screen } from "@testing-library/react";
import { accommodationAmenityLabels } from "../lib/accommodationLabels";
import AmenityIcon from "./AmenityIcon";
import { accommodationAmenityIconRegistry } from "./amenityIconRegistry";

describe("AmenityIcon", () => {
  it("maps every amenity code recognized by the detail owner", () => {
    const supportedCodes = Object.keys(accommodationAmenityLabels).sort();
    const mappedCodes = Object.keys(
      accommodationAmenityIconRegistry.glyphs,
    ).sort();

    expect(mappedCodes).toEqual(supportedCodes);
    expect(
      supportedCodes.filter(
        (code) => !accommodationAmenityIconRegistry.has(code),
      ),
    ).toEqual([]);
  });

  it("renders an accessible icon for an amenity type", () => {
    render(<AmenityIcon type="WIFI" />);

    const icon = screen.getByRole("img", { name: "WIFI" });

    expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
    expect(icon).toHaveAttribute("stroke", "currentColor");
    expect(icon).toHaveStyle({ width: "24px", height: "24px" });
  });

  it("preserves fill-based pictograms alongside stroke-based pictograms", () => {
    render(<AmenityIcon type="HEATING" />);

    const icon = screen.getByRole("img", { name: "HEATING" });

    expect(icon).toHaveAttribute("fill", "currentColor");
    expect(icon).toHaveAttribute("stroke", "none");
  });

  it("renders the fallback icon for unknown amenity types", () => {
    render(<AmenityIcon type="UNKNOWN_AMENITY" />);

    const icon = screen.getByRole("img", { name: "UNKNOWN_AMENITY" });

    expect(icon).toHaveAttribute("stroke", "currentColor");
    expect(icon).toHaveAttribute("fill", "none");
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
