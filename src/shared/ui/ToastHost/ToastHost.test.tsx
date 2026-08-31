import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "fs";
import { join } from "path";
import { ToastHost } from "./ToastHost";

describe("ToastHost", () => {
  it("announces a message inside the fixed host", () => {
    render(<ToastHost message="저장에 실패했습니다." onClose={jest.fn()} />);

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("저장에 실패했습니다.");
    expect(screen.getByTestId("toast-host")).toHaveClass("host");
  });

  it("delegates close clicks", async () => {
    const onClose = jest.fn();

    render(
      <ToastHost
        message="저장에 실패했습니다."
        onClose={onClose}
        closeLabel="오류 닫기"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "오류 닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("auto closes after the configured duration", () => {
    jest.useFakeTimers();
    const onClose = jest.fn();

    try {
      render(
        <ToastHost
          message="저장에 실패했습니다."
          onClose={onClose}
          duration={1500}
        />
      );

      act(() => {
        jest.advanceTimersByTime(1499);
      });
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("restarts the dismiss timer when the message changes", () => {
    jest.useFakeTimers();
    const onClose = jest.fn();

    try {
      const view = render(
        <ToastHost message="첫 번째 메시지" onClose={onClose} duration={1500} />,
      );

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      view.rerender(
        <ToastHost message="두 번째 메시지" onClose={onClose} duration={1500} />,
      );

      act(() => {
        jest.advanceTimersByTime(1499);
      });
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("uses the latest onClose without restarting the active timer", () => {
    jest.useFakeTimers();
    const firstOnClose = jest.fn();
    const latestOnClose = jest.fn();

    try {
      const view = render(
        <ToastHost
          message="저장 완료"
          onClose={firstOnClose}
          duration={1500}
        />,
      );

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      view.rerender(
        <ToastHost
          message="저장 완료"
          onClose={latestOnClose}
          duration={1500}
        />,
      );

      act(() => {
        jest.advanceTimersByTime(499);
      });
      expect(firstOnClose).not.toHaveBeenCalled();
      expect(latestOnClose).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(firstOnClose).not.toHaveBeenCalled();
      expect(latestOnClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps a required recovery action visible without auto closing", () => {
    jest.useFakeTimers();
    const onAction = jest.fn();
    const onClose = jest.fn();

    try {
      render(
        <ToastHost
          action={{ label: "복구 다시 시도", onClick: onAction }}
          dismissible={false}
          message="저장 복구가 필요합니다."
          onClose={onClose}
        />,
      );

      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(onAction).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("button", { name: "닫기" }),
      ).not.toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: "복구 다시 시도" }),
      );

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("bounds narrow toasts inside safe viewport insets", () => {
    const css = readFileSync(
      join(process.cwd(), "src/shared/ui/ToastHost/ToastHost.module.css"),
      "utf8",
    );

    expect(css).toMatch(/\.toast\s*{[^}]*box-sizing:\s*border-box;/s);
    expect(css).toContain(
      "min-width: min(300px, var(--toast-viewport-inline-space));",
    );
    expect(css).toContain(
      "max-width: min(500px, var(--toast-viewport-inline-space));",
    );
    expect(css).toContain("env(safe-area-inset-top, 0px)");
    expect(css).toContain("env(safe-area-inset-right, 0px)");
    expect(css).toContain("env(safe-area-inset-left, 0px)");
  });

  it("removes toast animation for reduced motion", () => {
    const css = readFileSync(
      join(process.cwd(), "src/shared/ui/ToastHost/ToastHost.module.css"),
      "utf8",
    );

    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{[\s\S]*\.toast\s*{[^}]*animation:\s*none;/,
    );
  });
});
