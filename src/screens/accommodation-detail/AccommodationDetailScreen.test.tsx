import { fireEvent, render, screen } from "@testing-library/react";
import { AccommodationDetailScreen } from "./AccommodationDetailScreen";

describe("AccommodationDetailScreen", () => {
  it("renders an announced loading skeleton and resource-error terminal", () => {
    const { rerender } = render(
      <AccommodationDetailScreen
        errorMessage={null}
        onClearError={vi.fn()}
        state={{ status: "loading" }}
      />,
    );
    expect(
      screen.getByText("숙소 정보를 불러오는 중입니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-state-kind",
      "loading",
    );

    rerender(
      <AccommodationDetailScreen
        errorMessage={null}
        onClearError={vi.fn()}
        state={{
          status: "terminal-error",
          message: "숙소를 찾을 수 없습니다.",
        }}
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

  it("offers one explicit retry action for recoverable detail errors", () => {
    const onRetry = vi.fn();
    const view = render(
      <AccommodationDetailScreen
        errorMessage={null}
        onClearError={vi.fn()}
        state={{
          status: "retryable-error",
          message: "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
          onRetry,
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-state-kind",
      "retryable-error",
    );
    const retryButton = screen.getByRole("button", { name: "다시 시도" });
    retryButton.focus();
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("region", { name: "숙소 상세 상태" }),
    ).toHaveFocus();

    view.rerender(
      <AccommodationDetailScreen
        errorMessage={null}
        onClearError={vi.fn()}
        state={{ status: "loading" }}
      />,
    );
    expect(
      screen.getByRole("region", { name: "숙소 상세 상태" }),
    ).toHaveFocus();
  });
});
