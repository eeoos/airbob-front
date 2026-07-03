import { render, screen } from "@testing-library/react";
import AmenityIcon from "./AmenityIcon";

describe("AmenityIcon", () => {
  it("renders an accessible icon for an amenity type", () => {
    render(<AmenityIcon type="WIFI" />);

    const icon = screen.getByRole("img", { name: "WIFI" });

    expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
    expect(icon.querySelector('path[d="M5 12.55a11 11 0 0 1 14.08 0"]')).toBeInTheDocument();
  });

  it("renders the fallback icon for unknown amenity types", () => {
    render(<AmenityIcon type="UNKNOWN_AMENITY" />);

    const icon = screen.getByRole("img", { name: "UNKNOWN_AMENITY" });

    expect(icon.querySelector('circle[cx="12"][cy="12"][r="10"]')).toBeInTheDocument();
  });
});
