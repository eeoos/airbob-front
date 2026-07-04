import * as fs from "fs";
import * as path from "path";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "./IconButton";

const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("IconButton", () => {
  it("keeps the clickable box at the shared touch target size", () => {
    const css = readProjectFile(
      "src/shared/ui/IconButton/IconButton.module.css"
    );

    expect(css).toContain("min-width: var(--control-touch-target);");
    expect(css).toContain("min-height: var(--control-touch-target);");
  });

  it("uses label as the accessible name and default title", () => {
    render(<IconButton label="검색">⌕</IconButton>);

    const button = screen.getByRole("button", { name: "검색" });

    expect(button).toHaveAttribute("aria-label", "검색");
    expect(button).toHaveAttribute("title", "검색");
    expect(button).toHaveTextContent("⌕");
  });

  it("preserves an explicit title while keeping the accessible label", () => {
    render(
      <IconButton label="필터 열기" title="필터">
        F
      </IconButton>
    );

    const button = screen.getByRole("button", { name: "필터 열기" });

    expect(button).toHaveAttribute("title", "필터");
  });

  it("forwards native button props", async () => {
    const handleClick = jest.fn();

    render(
      <IconButton label="저장" type="submit" onClick={handleClick}>
        S
      </IconButton>
    );

    const button = screen.getByRole("button", { name: "저장" });

    expect(button).toHaveAttribute("type", "submit");
    await userEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("keeps disabled buttons from firing click handlers", async () => {
    const handleClick = jest.fn();

    render(
      <IconButton label="삭제" disabled onClick={handleClick}>
        D
      </IconButton>
    );

    const button = screen.getByRole("button", { name: "삭제" });

    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies size, variant, and custom classes", () => {
    render(
      <IconButton
        label="더보기"
        size="sm"
        variant="secondary"
        className="custom-icon"
      >
        +
      </IconButton>
    );

    expect(screen.getByRole("button", { name: "더보기" })).toHaveClass(
      "iconButton",
      "sm",
      "secondary",
      "custom-icon"
    );
  });
});
