import React from "react";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders native button content and forwards button props", () => {
    const handleClick = jest.fn();

    render(
      <Button type="submit" variant="secondary" onClick={handleClick}>
        저장
      </Button>
    );

    const button = screen.getByRole("button", { name: "저장" });

    expect(button).toHaveAttribute("type", "submit");
    button.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to type button so forms are not submitted accidentally", () => {
    render(<Button>닫기</Button>);

    expect(screen.getByRole("button", { name: "닫기" })).toHaveAttribute(
      "type",
      "button"
    );
  });

  it("disables interaction while loading and exposes loading text", () => {
    render(
      <Button isLoading loadingLabel="처리 중">
        예약하기
      </Button>
    );

    const button = screen.getByRole("button", { name: "처리 중" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("uses a Korean default loading label", () => {
    render(<Button isLoading>저장</Button>);

    expect(screen.getByRole("button", { name: "처리 중..." })).toBeDisabled();
  });

  it("supports full width styling without dropping custom class names", () => {
    render(
      <Button fullWidth className="custom-action">
        계속
      </Button>
    );

    expect(screen.getByRole("button", { name: "계속" })).toHaveClass(
      "custom-action"
    );
  });
});
