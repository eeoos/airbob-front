import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

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

  it("respects an autofocus child as the initial focus target", () => {
    render(
      <Dialog isOpen title="위시리스트 만들기" onClose={jest.fn()}>
        <input aria-label="이름" autoFocus />
      </Dialog>
    );

    expect(screen.getByLabelText("이름")).toHaveFocus();
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

  it("restores focus after closing a dialog with an autofocus child", async () => {
    function DialogFixture() {
      const [isOpen, setIsOpen] = React.useState(false);

      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            열기
          </button>
          <Dialog
            isOpen={isOpen}
            title="위시리스트 만들기"
            onClose={() => setIsOpen(false)}
          >
            <input aria-label="이름" autoFocus />
          </Dialog>
        </>
      );
    }

    render(<DialogFixture />);

    const openButton = screen.getByRole("button", { name: "열기" });
    openButton.focus();

    await userEvent.click(openButton);
    expect(screen.getByLabelText("이름")).toHaveFocus();

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

  it("supports headerless dialogs with an accessible aria-label", () => {
    render(
      <Dialog isOpen title="후기 2개" onClose={jest.fn()} showHeader={false}>
        <button type="button" autoFocus>
          후기 닫기
        </button>
        content
      </Dialog>
    );

    expect(screen.getByRole("dialog", { name: "후기 2개" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "후기 2개" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "후기 닫기" })).toHaveFocus();
  });

  it("moves focus to the first focusable child in a headerless dialog", () => {
    render(
      <Dialog isOpen title="상세 주소 확인" onClose={jest.fn()} showHeader={false}>
        <button type="button">취소</button>
        <button type="button">진행하기</button>
      </Dialog>
    );

    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
  });

  it("can disable backdrop close for modal workflows that require explicit actions", async () => {
    const onClose = jest.fn();
    render(
      <Dialog isOpen title="예약 확인" onClose={onClose} closeOnBackdrop={false}>
        content
      </Dialog>
    );

    await userEvent.click(screen.getByRole("presentation"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("applies custom size and body padding variants without losing content", () => {
    render(
      <Dialog
        isOpen
        title="후기"
        onClose={jest.fn()}
        size="xl"
        bodyPadding="none"
      >
        content
      </Dialog>
    );

    expect(screen.getByRole("dialog", { name: "후기" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
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

  it("keeps body scroll locked until every open dialog closes", () => {
    document.body.style.overflow = "auto";

    const { rerender, unmount } = render(
      <>
        <Dialog isOpen title="첫 번째" onClose={jest.fn()}>
          content
        </Dialog>
        <Dialog isOpen title="두 번째" onClose={jest.fn()}>
          content
        </Dialog>
      </>
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <>
        <Dialog isOpen={false} title="첫 번째" onClose={jest.fn()}>
          content
        </Dialog>
        <Dialog isOpen title="두 번째" onClose={jest.fn()}>
          content
        </Dialog>
      </>
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).toBe("auto");
  });
});
