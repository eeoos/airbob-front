import { render, screen } from "@testing-library/react";
import {
  EmptyState,
  LoadingState,
  RetryableErrorState,
  TerminalErrorState,
} from "./StateView";

describe("StateView", () => {
  it("renders an accessible loading state", () => {
    render(<LoadingState title="숙소를 불러오는 중" />);

    expect(screen.getByRole("status")).toHaveTextContent("숙소를 불러오는 중");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-state-kind",
      "loading",
    );
  });

  it("renders empty state content and an optional action", () => {
    render(
      <EmptyState
        title="저장한 숙소가 없습니다"
        description="마음에 드는 숙소를 저장해보세요."
        action={<button type="button">검색하기</button>}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "저장한 숙소가 없습니다",
    );
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-state-kind",
      "empty",
    );
    expect(
      screen.getByText("마음에 드는 숙소를 저장해보세요."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "검색하기" }),
    ).toBeInTheDocument();
  });

  it("distinguishes retryable and terminal alert recipes", () => {
    render(
      <RetryableErrorState
        title="요청을 완료하지 못했습니다"
        description="잠시 후 다시 시도해주세요."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "잠시 후 다시 시도해주세요.",
    );
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-state-kind",
      "retryable-error",
    );

    render(<TerminalErrorState title="요청에 실패했습니다" />);

    expect(screen.getAllByRole("alert")[1]).toHaveAttribute(
      "data-state-kind",
      "terminal-error",
    );
  });
});
