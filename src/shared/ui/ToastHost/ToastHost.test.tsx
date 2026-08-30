import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
});
