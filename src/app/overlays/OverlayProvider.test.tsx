import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Dialog } from "../../shared/ui/Dialog";
import { ToastHost } from "../../shared/ui/ToastHost/ToastHost";
import {
  type OverlayModality,
  useOverlayRegistration,
} from "../../shared/ui/overlayRuntime";
import {
  APP_ROOT_ID,
  APP_OVERLAY_ROOT_ID,
  OverlayProvider,
} from "./OverlayProvider";

function RegisteredOverlay({
  modality,
  onClose,
}: {
  readonly modality: OverlayModality;
  readonly onClose: () => void;
}) {
  const elementRef = React.useRef<HTMLDivElement>(null);
  const layerRef = React.useRef<HTMLDivElement>(null);

  useOverlayRegistration({
    elementRef,
    enabled: true,
    layerRef,
    modality,
    onClose,
    restoreFocusTo: null,
  });

  return (
    <div ref={layerRef} data-testid={`${modality}-layer`}>
      <div ref={elementRef} tabIndex={-1}>
        {modality}
      </div>
    </div>
  );
}

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
          <Dialog isOpen title="확인" onClose={vi.fn()}>
            dialog content
          </Dialog>
          <ToastHost message="저장 완료" onClose={vi.fn()} />
        </div>
      </OverlayProvider>,
    );

    const portalRoot = screen.getByTestId(APP_OVERLAY_ROOT_ID);

    const dialog = screen.getByRole("dialog", { name: "확인" });
    const routeToast = screen.getByRole("alert");

    expect(portalRoot).toContainElement(dialog);
    expect(portalRoot).toContainElement(routeToast);
    expect(dialog).not.toContainElement(routeToast);
    expect(screen.getByTestId("route-owner")).not.toContainElement(
      screen.getByRole("dialog", { name: "확인" }),
    );
  });

  it("keeps an interactive dialog Toast inside the dialog focus scope", async () => {
    render(
      <OverlayProvider>
        <Dialog isOpen title="저장 확인" onClose={vi.fn()}>
          <button type="button">본문 작업</button>
          <ToastHost
            action={{ label: "다시 시도", onClick: vi.fn() }}
            closeLabel="알림 닫기"
            message="저장에 실패했습니다."
            onClose={vi.fn()}
          />
        </Dialog>
      </OverlayProvider>,
    );

    const dialog = screen.getByRole("dialog", { name: "저장 확인" });
    const dialogClose = within(dialog).getByRole("button", { name: "닫기" });
    const bodyAction = within(dialog).getByRole("button", {
      name: "본문 작업",
    });
    const toastAction = within(dialog).getByRole("button", {
      name: "다시 시도",
    });
    const toastClose = within(dialog).getByRole("button", {
      name: "알림 닫기",
    });

    expect(dialog).toContainElement(within(dialog).getByRole("alert"));
    expect(dialogClose).toHaveFocus();

    await userEvent.tab();
    expect(bodyAction).toHaveFocus();
    await userEvent.tab();
    expect(toastAction).toHaveFocus();
    await userEvent.tab();
    expect(toastClose).toHaveFocus();
    await userEvent.tab();
    expect(dialogClose).toHaveFocus();
  });

  it("waits for an active dialog layer before honoring explicit initial focus", async () => {
    const portalRoot = document.createElement("div");
    document.body.appendChild(portalRoot);
    const browserFocus = HTMLElement.prototype.focus;
    const focusSpy = vi
      .spyOn(HTMLElement.prototype, "focus")
      .mockImplementation(function inertAwareFocus(this: HTMLElement) {
        // Browser focus ignores descendants of an inert layer; JSDOM does not.
        // eslint-disable-next-line testing-library/no-node-access
        if (this.closest("[inert]")) return;

        browserFocus.call(this);
      });

    try {
      const BrowserFocusDialog = () => {
        const initialFocusRef = React.useRef<HTMLInputElement>(null);

        return (
          <Dialog
            initialFocusRef={initialFocusRef}
            isOpen
            title="브라우저 포커스"
            onClose={vi.fn()}
          >
            <input ref={initialFocusRef} autoFocus aria-label="이름" />
          </Dialog>
        );
      };

      render(
        <OverlayProvider portalRoot={portalRoot}>
          <BrowserFocusDialog />
        </OverlayProvider>,
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByRole("textbox", { name: "이름" })).toHaveFocus();
    } finally {
      focusSpy.mockRestore();
      portalRoot.remove();
    }
  });

  it("does not lock or hide the application for a non-modal registration", () => {
    const applicationRoot = document.createElement("div");
    applicationRoot.setAttribute("aria-hidden", "false");
    applicationRoot.setAttribute("inert", "existing");
    document.body.appendChild(applicationRoot);
    document.body.style.overflow = "scroll";

    const view = render(
      <OverlayProvider applicationRoot={applicationRoot}>
        <RegisteredOverlay modality="non-modal" onClose={vi.fn()} />
      </OverlayProvider>,
    );

    expect(applicationRoot).toHaveAttribute("aria-hidden", "false");
    expect(applicationRoot).toHaveAttribute("inert", "existing");
    expect(document.body).toHaveStyle({ overflow: "scroll" });

    view.unmount();
    applicationRoot.remove();
  });

  it("keeps Dialog topmost state modal-only while Escape follows the whole stack", async () => {
    const closeDialog = vi.fn();
    const closeNonModal = vi.fn();

    render(
      <OverlayProvider>
        <Dialog isOpen title="대화상자" onClose={closeDialog}>
          content
        </Dialog>
        <RegisteredOverlay modality="non-modal" onClose={closeNonModal} />
      </OverlayProvider>,
    );

    expect(screen.getByRole("presentation")).not.toHaveAttribute("inert");

    await userEvent.keyboard("{Escape}");

    expect(closeNonModal).toHaveBeenCalledTimes(1);
    expect(closeDialog).not.toHaveBeenCalled();
  });

  it("lets only the topmost dialog handle Escape and backdrop dismissal", async () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();

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
    const firstBackdrop = backdrops.at(0);
    const secondBackdrop = backdrops.at(1);
    if (!firstBackdrop || !secondBackdrop) {
      throw new Error("Expected two dialog backdrops");
    }
    expect(firstBackdrop).toHaveAttribute("aria-hidden", "true");
    expect(firstBackdrop).toHaveAttribute("inert");
    expect(secondBackdrop).not.toHaveAttribute("aria-hidden");
    expect(secondBackdrop).not.toHaveAttribute("inert");

    fireEvent.mouseDown(firstBackdrop);
    expect(closeFirst).not.toHaveBeenCalled();

    await userEvent.click(secondBackdrop);
    expect(closeSecond).toHaveBeenCalledTimes(2);
  });

  it("leaves Escape to a child control that prevents its default behavior", () => {
    const closeDialog = vi.fn();
    const handleChildEscape = vi.fn();

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
        <Dialog isOpen={false} title="첫 번째" onClose={vi.fn()}>
          first content
        </Dialog>
        <Dialog isOpen title="두 번째" onClose={vi.fn()}>
          second content
        </Dialog>
      </OverlayProvider>,
    );

    view.rerender(
      <OverlayProvider>
        <Dialog isOpen title="첫 번째" onClose={vi.fn()}>
          first content
        </Dialog>
        <Dialog isOpen title="두 번째" onClose={vi.fn()}>
          second content
        </Dialog>
      </OverlayProvider>,
    );

    const backdrops = screen.getAllByRole("presentation", { hidden: true });
    const firstBackdrop = backdrops.at(0);
    const secondBackdrop = backdrops.at(1);
    if (!firstBackdrop || !secondBackdrop) {
      throw new Error("Expected two dialog backdrops");
    }
    expect(
      within(secondBackdrop).getByText("first content"),
    ).toBeInTheDocument();
    expect(secondBackdrop).not.toHaveAttribute("inert");
    expect(firstBackdrop).toHaveAttribute("inert");
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
    const innerClose = within(innerDialog).getByRole("button", {
      name: "닫기",
    });
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
          <Dialog isOpen title="첫 번째" onClose={vi.fn()}>
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
        <Dialog isOpen title="첫 번째" onClose={vi.fn()}>
          first
        </Dialog>
        <Dialog isOpen title="두 번째" onClose={vi.fn()}>
          second
        </Dialog>
        <ToastHost message="route toast" onClose={vi.fn()} />
      </OverlayProvider>,
    );
    const portalRoot = screen.getByTestId(APP_OVERLAY_ROOT_ID);

    expect(document.body).toHaveStyle({ overflow: "hidden" });
    expect(
      within(portalRoot).getAllByRole("presentation", { hidden: true }),
    ).toHaveLength(2);
    expect(within(portalRoot).getByRole("alert")).toBeInTheDocument();

    view.rerender(<OverlayProvider>{null}</OverlayProvider>);

    expect(document.body).toHaveStyle({ overflow: "auto" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps background isolation until a stateful modal stack reaches zero", async () => {
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

    const applicationRoot = document.createElement("div");
    applicationRoot.id = APP_ROOT_ID;
    applicationRoot.setAttribute("aria-hidden", "false");
    applicationRoot.setAttribute("inert", "existing");
    document.body.appendChild(applicationRoot);
    document.body.style.overflow = "scroll";
    const view = render(
      <OverlayProvider>
        <StatefulDialogStack />
      </OverlayProvider>,
    );

    expect(document.body).toHaveStyle({ overflow: "hidden" });
    expect(applicationRoot).toHaveAttribute("aria-hidden", "true");
    expect(applicationRoot).toHaveAttribute("inert", "");

    await userEvent.click(
      within(screen.getByRole("dialog", { name: "두 번째" })).getByRole(
        "button",
        { name: "닫기" },
      ),
    );
    expect(screen.getByRole("dialog", { name: "첫 번째" })).toBeInTheDocument();
    expect(document.body).toHaveStyle({ overflow: "hidden" });
    expect(applicationRoot).toHaveAttribute("aria-hidden", "true");
    expect(applicationRoot).toHaveAttribute("inert", "");

    await userEvent.click(
      within(screen.getByRole("dialog", { name: "첫 번째" })).getByRole(
        "button",
        { name: "닫기" },
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).toHaveStyle({ overflow: "scroll" });
    expect(applicationRoot).toHaveAttribute("aria-hidden", "false");
    expect(applicationRoot).toHaveAttribute("inert", "existing");

    view.unmount();
    applicationRoot.remove();
  });

  it("removes background inert before restoring focus after the last dialog closes", async () => {
    function StatefulDialog() {
      const [isOpen, setIsOpen] = React.useState(false);

      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            열기
          </button>
          <Dialog isOpen={isOpen} title="확인" onClose={() => setIsOpen(false)}>
            content
          </Dialog>
        </>
      );
    }

    const applicationRoot = document.createElement("div");
    document.body.appendChild(applicationRoot);
    const view = render(
      <OverlayProvider applicationRoot={applicationRoot}>
        <StatefulDialog />
      </OverlayProvider>,
      { container: applicationRoot },
    );
    const trigger = screen.getByRole("button", { name: "열기" });

    await userEvent.click(trigger);
    expect(applicationRoot).toHaveAttribute("aria-hidden", "true");
    expect(applicationRoot).toHaveAttribute("inert");

    const focusTrigger = trigger.focus.bind(trigger);
    const focusSpy = vi.spyOn(trigger, "focus").mockImplementation(() => {
      expect(applicationRoot).not.toHaveAttribute("aria-hidden");
      expect(applicationRoot).not.toHaveAttribute("inert");
      focusTrigger();
    });

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();

    focusSpy.mockRestore();
    view.unmount();
    applicationRoot.remove();
  });

  it("clears toast timers and removes a provider-owned root on unmount", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    try {
      const view = render(
        <OverlayProvider>
          <ToastHost message="route toast" onClose={onClose} duration={1000} />
        </OverlayProvider>,
      );

      expect(screen.getByTestId(APP_OVERLAY_ROOT_ID)).toBeInTheDocument();
      view.unmount();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByTestId(APP_OVERLAY_ROOT_ID)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps one active provider-created root through StrictMode replay", async () => {
    const applicationRoot = document.createElement("div");
    applicationRoot.setAttribute("aria-hidden", "false");
    applicationRoot.setAttribute("inert", "existing");
    document.body.appendChild(applicationRoot);
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const focusOpener = vi.spyOn(opener, "focus");

    const view = render(
      <OverlayProvider applicationRoot={applicationRoot}>
        <Dialog isOpen title="Strict 대화상자" onClose={vi.fn()}>
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
    expect(document.body).toHaveStyle({ overflow: "hidden" });
    expect(applicationRoot).toHaveAttribute("aria-hidden", "true");
    expect(applicationRoot).toHaveAttribute("inert", "");

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
    expect(document.body).toHaveStyle({ overflow: "" });
    expect(applicationRoot).toHaveAttribute("aria-hidden", "false");
    expect(applicationRoot).toHaveAttribute("inert", "existing");

    focusOpener.mockRestore();
    opener.remove();
    applicationRoot.remove();
  });
});
