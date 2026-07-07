import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "fs";
import { ErrorBoundary } from "./ErrorBoundary";

let shouldThrow = true;

const MaybeThrowingChild = () => {
  if (shouldThrow) {
    throw new Error("테스트 오류");
  }

  return <div>복구된 화면</div>;
};

describe("ErrorBoundary", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    shouldThrow = true;
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders the default recovery UI with a shared button action", () => {
    render(
      <ErrorBoundary>
        <MaybeThrowingChild />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "오류가 발생했습니다" })
    ).toBeInTheDocument();
    expect(screen.getByText("테스트 오류")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeEnabled();
  });

  it("resets the boundary when the retry action succeeds", async () => {
    render(
      <ErrorBoundary>
        <MaybeThrowingChild />
      </ErrorBoundary>,
    );

    shouldThrow = false;
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(screen.getByText("복구된 화면")).toBeInTheDocument();
  });

  it("renders a provided fallback instead of the default recovery UI", () => {
    render(
      <ErrorBoundary fallback={<div role="alert">대체 오류 화면</div>}>
        <MaybeThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("대체 오류 화면");
    expect(
      screen.queryByRole("button", { name: "다시 시도" })
    ).not.toBeInTheDocument();
  });

  it("keeps fallback styling on token-backed CSS values", () => {
    const css = readFileSync(`${__dirname}/ErrorBoundary.module.css`, "utf8");

    expect(css).toContain("color: var(--color-text-primary);");
    expect(css).toContain("color: var(--color-text-secondary);");
    expect(css).toContain("background-color: var(--color-text-primary);");
    expect(css).toContain("color: var(--color-text-inverse);");
  });
});
