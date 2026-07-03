import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorToast } from "./ErrorToast";

describe("ErrorToast", () => {
  it("announces the error and labels the close action", async () => {
    const onClose = jest.fn();

    render(
      <ErrorToast
        message="저장에 실패했습니다."
        onClose={onClose}
        duration={10000}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "저장에 실패했습니다."
    );

    await userEvent.click(screen.getByRole("button", { name: "오류 닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
