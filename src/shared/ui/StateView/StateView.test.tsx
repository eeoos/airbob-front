import React from "react";
import { render, screen } from "@testing-library/react";
import { EmptyState, ErrorState, LoadingState } from "./StateView";

describe("StateView", () => {
  it("renders an accessible loading state", () => {
    render(<LoadingState title="숙소를 불러오는 중" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "숙소를 불러오는 중"
    );
  });

  it("renders empty state content and an optional action", () => {
    render(
      <EmptyState
        title="저장한 숙소가 없습니다"
        description="마음에 드는 숙소를 저장해보세요."
        action={<button type="button">검색하기</button>}
      />
    );

    expect(screen.getByText("저장한 숙소가 없습니다")).toBeInTheDocument();
    expect(screen.getByText("마음에 드는 숙소를 저장해보세요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "검색하기" })).toBeInTheDocument();
  });

  it("renders an alert for error states", () => {
    render(
      <ErrorState
        title="요청에 실패했습니다"
        description="잠시 후 다시 시도해주세요."
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("요청에 실패했습니다");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "잠시 후 다시 시도해주세요."
    );
  });
});
