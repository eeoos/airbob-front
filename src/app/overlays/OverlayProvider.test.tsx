import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Dialog } from "../../shared/ui/Dialog";
import { ToastHost } from "../../shared/ui/ToastHost/ToastHost";
import {
  APP_OVERLAY_ROOT_ID,
  OverlayProvider,
} from "./OverlayProvider";

describe("OverlayProvider", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("creates one app portal root and portals Dialog and ToastHost into it", () => {
    render(
      <OverlayProvider>
        <div data-testid="route-owner">
          <Dialog isOpen title="확인" onClose={jest.fn()}>
            dialog content
          </Dialog>
          <ToastHost message="저장 완료" onClose={jest.fn()} />
        </div>
      </OverlayProvider>,
    );

    const portalRoot = screen.getByTestId(APP_OVERLAY_ROOT_ID);

    expect(portalRoot).toContainElement(
      screen.getByRole("dialog", { name: "확인" }),
    );
    expect(portalRoot).toContainElement(screen.getByRole("alert"));
    expect(screen.getByTestId("route-owner")).not.toContainElement(
      screen.getByRole("dialog", { name: "확인" }),
    );
  });

  it("lets only the topmost dialog handle Escape and backdrop dismissal", async () => {
    const closeFirst = jest.fn();
    const closeSecond = jest.fn();

    render(
      <OverlayProvider>
        <Dialog isOpen title="첫 번째" onClose={closeFirst}>
          first
        </Dialog>
        <Dialog isOpen title="두 번째" onClose={closeSecond}>
          second
        </Dialog>
      </OverlayProvider>,
    );

    await userEvent.keyboard("{Escape}");

    expect(closeFirst).not.toHaveBeenCalled();
    expect(closeSecond).toHaveBeenCalledTimes(1);

    const backdrops = screen.getAllByRole("presentation", { hidden: true });
    expect(backdrops[0]).toHaveAttribute("aria-hidden", "true");
    expect(backdrops[0]).toHaveAttribute("inert");
    expect(backdrops[1]).not.toHaveAttribute("aria-hidden");
    expect(backdrops[1]).not.toHaveAttribute("inert");

    fireEvent.mouseDown(backdrops[0]);
    expect(closeFirst).not.toHaveBeenCalled();

    await userEvent.click(backdrops[1]);
    expect(closeSecond).toHaveBeenCalledTimes(2);
  });

  it("leaves Escape to a child control that prevents its default behavior", () => {
    const closeDialog = jest.fn();
    const handleChildEscape = jest.fn();

    render(
      <OverlayProvider>
        <Dialog isOpen title="검색 선택" onClose={closeDialog}>
          <input
            autoFocus
            aria-label="검색어"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;

              event.preventDefault();
              handleChildEscape();
            }}
          />
        </Dialog>
      </OverlayProvider>,
    );

    fireEvent.keyDown(screen.getByRole("textbox", { name: "검색어" }), {
      key: "Escape",
    });

    expect(handleChildEscape).toHaveBeenCalledTimes(1);
    expect(closeDialog).not.toHaveBeenCalled();
  });

  it("keeps portal DOM order aligned when an earlier dialog opens last", () => {
    const view = render(
      <OverlayProvider>
        <Dialog isOpen={false} title="첫 번째" onClose={jest.fn()}>
          first content
        </Dialog>
        <Dialog isOpen title="두 번째" onClose={jest.fn()}>
          second content
        </Dialog>
      </OverlayProvider>,
    );

    view.rerender(
      <OverlayProvider>
        <Dialog isOpen title="첫 번째" onClose={jest.fn()}>
          first content
        </Dialog>
        <Dialog isOpen title="두 번째" onClose={jest.fn()}>
          second content
        </Dialog>
      </OverlayProvider>,
    );

    const backdrops = screen.getAllByRole("presentation", { hidden: true });
    expect(within(backdrops[1]).getByText("first content")).toBeInTheDocument();
    expect(backdrops[1]).not.toHaveAttribute("inert");
    expect(backdrops[0]).toHaveAttribute("inert");
  });

  it("contains focus in the topmost dialog and restores the nested focus chain", async () => {
    function NestedDialogFixture() {
      const [outerOpen, setOuterOpen] = React.useState(false);
      const [innerOpen, setInnerOpen] = React.useState(false);

      return (
        <>
          <button type="button" onClick={() => setOuterOpen(true)}>
            바깥 열기
          </button>
          <Dialog
            isOpen={outerOpen}
            title="바깥"
            onClose={() => setOuterOpen(false)}
          >
            <button type="button" onClick={() => setInnerOpen(true)}>
              안쪽 열기
            </button>
            <Dialog
              isOpen={innerOpen}
              title="안쪽"
              onClose={() => setInnerOpen(false)}
            >
              <button type="button">첫 번째</button>
              <button type="button">마지막</button>
            </Dialog>
          </Dialog>
        </>
      );
    }

    render(
      <OverlayProvider>
        <NestedDialogFixture />
      </OverlayProvider>,
    );

    const outerTrigger = screen.getByRole("button", { name: "바깥 열기" });
    await userEvent.click(outerTrigger);
    const innerTrigger = screen.getByRole("button", { name: "안쪽 열기" });
    await userEvent.click(innerTrigger);

    const innerDialog = screen.getByRole("dialog", { name: "안쪽" });
    const innerClose = within(innerDialog).getByRole("button", { name: "닫기" });
    const first = within(innerDialog).getByRole("button", { name: "첫 번째" });
    const last = within(innerDialog).getByRole("button", { name: "마지막" });

    expect(innerClose).toHaveFocus();
    await userEvent.tab();
    expect(first).toHaveFocus();
    await userEvent.tab();
    expect(last).toHaveFocus();
    await userEvent.tab();
    expect(innerClose).toHaveFocus();

    await userEvent.click(innerClose);
    expect(innerTrigger).toHaveFocus();

    const outerDialog = screen.getByRole("dialog", { name: "바깥" });
    await userEvent.click(
      within(outerDialog).getByRole("button", { name: "닫기" }),
    );
    expect(outerTrigger).toHaveFocus();
  });

  it("preserves opener lineage while a replacement dialog becomes topmost", async () => {
    function ReplacementDialogFixture() {
      const [outerOpen, setOuterOpen] = React.useState(false);
      const [activeChild, setActiveChild] = React.useState<
        "none" | "second" | "third"
      >("none");

      return (
        <>
          <button type="button" onClick={() => setOuterOpen(true)}>
            바깥 열기
          </button>
          <Dialog
            isOpen={outerOpen}
            title="바깥"
            onClose={() => setOuterOpen(false)}
          >
            <button type="button" onClick={() => setActiveChild("second")}>
              두 번째 열기
            </button>
            <Dialog
              isOpen={activeChild === "second"}
              title="두 번째"
              onClose={() => setActiveChild("third")}
            >
              second content
            </Dialog>
            <Dialog
              isOpen={activeChild === "third"}
              title="세 번째"
              onClose={() => setActiveChild("none")}
            >
              third content
            </Dialog>
          </Dialog>
        </>
      );
    }

    render(
      <OverlayProvider>
        <ReplacementDialogFixture />
      </OverlayProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "바깥 열기" }));
    const secondTrigger = screen.getByRole("button", { name: "두 번째 열기" });
    await userEvent.click(secondTrigger);
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "두 번째" })).getByRole(
        "button",
        { name: "닫기" },
      ),
    );

    const replacementDialog = screen.getByRole("dialog", { name: "세 번째" });
    expect(
      within(replacementDialog).getByRole("button", { name: "닫기" }),
    ).toHaveFocus();
    expect(secondTrigger).not.toHaveFocus();

    await userEvent.click(
      within(replacementDialog).getByRole("button", { name: "닫기" }),
    );
    expect(secondTrigger).toHaveFocus();
  });

  it("falls back to the remaining topmost sibling when its opener is outside", async () => {
    function SiblingDialogFixture() {
      const [secondOpen, setSecondOpen] = React.useState(true);

      return (
        <>
          <Dialog isOpen title="첫 번째" onClose={jest.fn()}>
            first content
          </Dialog>
          <Dialog
            isOpen={secondOpen}
            title="두 번째"
            onClose={() => setSecondOpen(false)}
          >
            second content
          </Dialog>
        </>
      );
    }

    render(
      <OverlayProvider>
        <SiblingDialogFixture />
      </OverlayProvider>,
    );

    await userEvent.click(
      within(screen.getByRole("dialog", { name: "두 번째" })).getByRole(
        "button",
        { name: "닫기" },
      ),
    );

    const remainingDialog = screen.getByRole("dialog", { name: "첫 번째" });
    expect(remainingDialog).toHaveFocus();
  });

  it("restores the opener after a portaled autofocus target closes", async () => {
    function AutofocusDialogFixture() {
      const [isOpen, setIsOpen] = React.useState(false);

      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            만들기 열기
          </button>
          <Dialog
            isOpen={isOpen}
            title="만들기"
            onClose={() => setIsOpen(false)}
          >
            <input aria-label="이름" autoFocus />
          </Dialog>
        </>
      );
    }

    render(
      <OverlayProvider>
        <AutofocusDialogFixture />
      </OverlayProvider>,
    );

    const trigger = screen.getByRole("button", { name: "만들기 열기" });
    await userEvent.click(trigger);
    expect(screen.getByLabelText("이름")).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(trigger).toHaveFocus();
  });

  it("keeps scroll locked for nested dialogs and removes route-owned portal children", () => {
    document.body.style.overflow = "auto";
    const view = render(
      <OverlayProvider>
        <Dialog isOpen title="첫 번째" onClose={jest.fn()}>
          first
        </Dialog>
        <Dialog isOpen title="두 번째" onClose={jest.fn()}>
          second
        </Dialog>
        <ToastHost message="route toast" onClose={jest.fn()} />
      </OverlayProvider>,
    );
    const portalRoot = screen.getByTestId(APP_OVERLAY_ROOT_ID);

    expect(document.body.style.overflow).toBe("hidden");
    expect(
      within(portalRoot).getAllByRole("presentation", { hidden: true }),
    ).toHaveLength(2);
    expect(within(portalRoot).getByRole("alert")).toBeInTheDocument();

    view.rerender(<OverlayProvider>{null}</OverlayProvider>);

    expect(document.body.style.overflow).toBe("auto");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the prior overflow locked until a stateful stack reaches zero", async () => {
    function StatefulDialogStack() {
      const [openCount, setOpenCount] = React.useState(2);

      return (
        <>
          <Dialog
            isOpen={openCount >= 1}
            title="첫 번째"
            onClose={() => setOpenCount(0)}
          >
            first
          </Dialog>
          <Dialog
            isOpen={openCount >= 2}
            title="두 번째"
            onClose={() => setOpenCount(1)}
          >
            second
          </Dialog>
        </>
      );
    }

    document.body.style.overflow = "scroll";
    render(
      <OverlayProvider>
        <StatefulDialogStack />
      </OverlayProvider>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    await userEvent.click(
      within(screen.getByRole("dialog", { name: "두 번째" })).getByRole(
        "button",
        { name: "닫기" },
      ),
    );
    expect(screen.getByRole("dialog", { name: "첫 번째" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    await userEvent.click(
      within(screen.getByRole("dialog", { name: "첫 번째" })).getByRole(
        "button",
        { name: "닫기" },
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("clears toast timers and removes a provider-owned root on unmount", () => {
    jest.useFakeTimers();
    const onClose = jest.fn();

    try {
      const view = render(
        <OverlayProvider>
          <ToastHost message="route toast" onClose={onClose} duration={1000} />
        </OverlayProvider>,
      );

      expect(screen.getByTestId(APP_OVERLAY_ROOT_ID)).toBeInTheDocument();
      view.unmount();

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByTestId(APP_OVERLAY_ROOT_ID)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps one active provider-created root through StrictMode replay", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const focusOpener = jest.spyOn(opener, "focus");

    const view = render(
      <OverlayProvider>
        <Dialog isOpen title="Strict 대화상자" onClose={jest.fn()}>
          content
        </Dialog>
      </OverlayProvider>,
      { reactStrictMode: true },
    );

    expect(screen.getAllByTestId(APP_OVERLAY_ROOT_ID)).toHaveLength(1);
    expect(
      screen.getByRole("dialog", { name: "Strict 대화상자" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("presentation")).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
    expect(focusOpener).not.toHaveBeenCalled();

    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(focusOpener).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(APP_OVERLAY_ROOT_ID)).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");

    focusOpener.mockRestore();
    opener.remove();
  });
});
