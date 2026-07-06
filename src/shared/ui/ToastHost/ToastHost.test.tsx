import { act, render, screen } from "@testing-library/react";
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
});
