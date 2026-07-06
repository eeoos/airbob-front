import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders status text with the requested tone", () => {
    render(<StatusBadge tone="success">확정됨</StatusBadge>);

    expect(screen.getByText("확정됨")).toHaveClass("badge", "success");
  });

  it("defaults to the neutral tone", () => {
    render(<StatusBadge>작성 중</StatusBadge>);

    expect(screen.getByText("작성 중")).toHaveClass("neutral");
  });
});
