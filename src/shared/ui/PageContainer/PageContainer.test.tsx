import { render, screen } from "@testing-library/react";
import { PageContainer } from "./PageContainer";

describe("PageContainer", () => {
  it.each(["edge", "full", "wide", "content", "narrow"] as const)(
    "owns the %s page-width and gutter recipe",
    (variant) => {
      render(
        <PageContainer variant={variant} data-testid="container">
          Page content
        </PageContainer>,
      );

      const container = screen.getByTestId("container");

      expect(container).toHaveAttribute("data-page-container", variant);
      expect(container).toHaveTextContent("Page content");
    },
  );

  it("preserves the requested semantic element and caller class", () => {
    render(
      <PageContainer
        as="section"
        aria-label="예약 확인"
        className="route-section"
        variant="content"
      >
        Details
      </PageContainer>,
    );

    expect(screen.getByRole("region", { name: "예약 확인" })).toHaveClass(
      "route-section",
    );
  });
});
