import { render, screen } from "@testing-library/react";
import AmenityIcon from "./AmenityIcon";

describe("AmenityIcon", () => {
  it("renders an accessible icon for an amenity type", () => {
    render(<AmenityIcon type="WIFI" />);

    const icon = screen.getByRole("img", { name: "WIFI" });

    expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
    expect(icon).toHaveAttribute("stroke", "currentColor");
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
