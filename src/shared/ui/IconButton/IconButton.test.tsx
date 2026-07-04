import * as fs from "fs";
import * as path from "path";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "./IconButton";

const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const getCssBlock = (source: string, selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  if (!match) {
    throw new Error(`Missing CSS block for ${selector}`);
  }

  return match[1];
};

describe("IconButton", () => {
  it("keeps compact visuals while exposing the shared touch target", () => {
    const css = readProjectFile(
      "src/shared/ui/IconButton/IconButton.module.css"
    );
    const baseStyles = getCssBlock(css, ".iconButton");
    const touchTargetStyles = getCssBlock(css, ".iconButton::before");
    const smallStyles = getCssBlock(css, ".sm");
    const mediumStyles = getCssBlock(css, ".md");

    expect(baseStyles).not.toContain("min-width: var(--control-touch-target);");
    expect(baseStyles).not.toContain("min-height: var(--control-touch-target);");
    expect(baseStyles).toContain("position: relative;");
    expect(touchTargetStyles).toContain("width: var(--control-touch-target);");
    expect(touchTargetStyles).toContain("height: var(--control-touch-target);");
    expect(smallStyles).toContain("width: 32px;");
    expect(smallStyles).toContain("height: 32px;");
    expect(mediumStyles).toContain("width: 40px;");
    expect(mediumStyles).toContain("height: 40px;");
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
