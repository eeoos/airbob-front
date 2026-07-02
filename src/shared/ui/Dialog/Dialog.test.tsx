import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
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

  it("moves focus to the close button when opened", () => {
    render(
      <Dialog isOpen title="위시리스트" onClose={jest.fn()}>
        <button type="button">담기</button>
      </Dialog>
    );

    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = jest.fn();
    render(
      <Dialog isOpen title="위시리스트" onClose={onClose}>
        content
      </Dialog>
    );

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the previously focused element when closed", async () => {
    function DialogFixture() {
      const [isOpen, setIsOpen] = React.useState(false);

      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            열기
          </button>
          <Dialog
            isOpen={isOpen}
            title="위시리스트"
            onClose={() => setIsOpen(false)}
          >
            content
          </Dialog>
        </>
      );
    }

    render(<DialogFixture />);

    const openButton = screen.getByRole("button", { name: "열기" });
    openButton.focus();

    await userEvent.click(openButton);
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(openButton).toHaveFocus();
  });

  it("keeps Tab focus within the dialog", async () => {
    render(
      <Dialog isOpen title="위시리스트" onClose={jest.fn()}>
        <button type="button">첫 번째</button>
        <button type="button">마지막</button>
      </Dialog>
    );

    const closeButton = screen.getByRole("button", { name: "닫기" });
    const firstButton = screen.getByRole("button", { name: "첫 번째" });
    const lastButton = screen.getByRole("button", { name: "마지막" });

    expect(closeButton).toHaveFocus();

    await userEvent.tab();
    expect(firstButton).toHaveFocus();

    await userEvent.tab();
    expect(lastButton).toHaveFocus();

    await userEvent.tab();
    expect(closeButton).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(lastButton).toHaveFocus();
  });

  it("calls onClose when the backdrop is pressed", async () => {
    const onClose = jest.fn();
    render(
      <Dialog isOpen title="위시리스트" onClose={onClose}>
        content
      </Dialog>
    );

    await userEvent.click(screen.getByRole("presentation"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the inner dialog is pressed", async () => {
    const onClose = jest.fn();
    render(
      <Dialog isOpen title="위시리스트" onClose={onClose}>
        content
      </Dialog>
    );

    await userEvent.click(screen.getByRole("dialog", { name: "위시리스트" }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
