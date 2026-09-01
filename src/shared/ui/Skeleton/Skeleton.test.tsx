import { render, screen } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("renders caller-owned geometry outside the accessibility tree", () => {
    render(
      <Skeleton
        className="hero-geometry"
        data-testid="hero-skeleton"
        data-skeleton-kind="hero"
      />,
    );

    const skeleton = screen.getByTestId("hero-skeleton");

    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton).toHaveAttribute("data-skeleton-kind", "hero");
    expect(skeleton).toHaveClass("hero-geometry");
    expect(skeleton).toBeEmptyDOMElement();
  });
});
