import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("does not render content when closed", () => {
    render(
      <Dialog isOpen={false} title="위시리스트" onClose={jest.fn()}>
        content
      </Dialog>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders an accessible modal dialog when open", () => {
    render(
      <Dialog isOpen title="위시리스트" onClose={jest.fn()}>
        content
      </Dialog>
    );

    expect(
      screen.getByRole("dialog", { name: "위시리스트" })
    ).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = jest.fn();
    render(
      <Dialog isOpen title="위시리스트" onClose={onClose}>
        content
      </Dialog>
    );

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
