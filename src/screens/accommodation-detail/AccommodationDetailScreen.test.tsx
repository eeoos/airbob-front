import { render, screen } from "@testing-library/react";
import { AccommodationDetailScreen } from "./AccommodationDetailScreen";

describe("AccommodationDetailScreen", () => {
  it("renders explicit loading and resource-error terminals", () => {
    const { rerender } = render(
      <AccommodationDetailScreen
        errorMessage={null}
        onClearError={vi.fn()}
        state={{ status: "loading" }}
      />,
    );
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-state-kind",
      "loading",
    );

    rerender(
      <AccommodationDetailScreen
        errorMessage={null}
        onClearError={vi.fn()}
        state={{ status: "error", message: "숙소를 찾을 수 없습니다." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "숙소를 찾을 수 없습니다.",
    );
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-state-kind",
      "terminal-error",
    );
  });
});
