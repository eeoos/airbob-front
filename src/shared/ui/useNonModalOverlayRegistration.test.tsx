import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { OverlayProvider } from "../../app/overlays/OverlayProvider";
import { useNonModalOverlayRegistration } from "./useNonModalOverlayRegistration";

interface PopoverFixtureProps {
  readonly label: string;
  readonly onClose?: () => void;
}

function PopoverFixture({ label, onClose }: PopoverFixtureProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const overlay = useNonModalOverlayRegistration({
    enabled: isOpen,
    onClose: () => {
      onClose?.();
      setIsOpen(false);
    },
    overlayRef: popoverRef,
    triggerRef,
  });

  return (
    <div data-testid={`${label}-owner`}>
      <button
        ref={triggerRef}
        aria-expanded={isOpen}
        type="button"
        onClick={() => setIsOpen(true)}
      >
        {label} 열기
      </button>
      {isOpen && (
        <div
          ref={popoverRef}
          data-testid={`${label}-popover`}
          onKeyDown={overlay.onKeyDown}
          tabIndex={-1}
        >
          <button type="button">{label} 작업</button>
        </div>
      )}
      <button type="button" onClick={() => setIsOpen(false)}>
        {label} 바깥 작업
      </button>
    </div>
  );
}

describe("useNonModalOverlayRegistration", () => {
  it("keeps the popover local, avoids modal side effects, and restores trigger focus", async () => {
    const view = render(
      <OverlayProvider>
        <PopoverFixture label="여행자" />
      </OverlayProvider>,
    );

    const trigger = screen.getByRole("button", { name: "여행자 열기" });
    await userEvent.click(trigger);

    const owner = screen.getByTestId("여행자-owner");
    const popover = screen.getByTestId("여행자-popover");
    expect(owner).toContainElement(popover);
    expect(view.container).toContainElement(popover);
    expect(document.body.style.overflow).toBe("");

    screen.getByRole("button", { name: "여행자 작업" }).focus();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByTestId("여행자-popover")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("lets the shared stack close only the topmost non-modal popover", async () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();

    render(
      <OverlayProvider>
        <PopoverFixture label="첫 번째" onClose={closeFirst} />
        <PopoverFixture label="두 번째" onClose={closeSecond} />
      </OverlayProvider>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "첫 번째 열기" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "두 번째 열기" }),
    );

    screen.getByRole("button", { name: "첫 번째 작업" }).focus();
    await userEvent.keyboard("{Escape}");

    expect(closeFirst).not.toHaveBeenCalled();
    expect(closeSecond).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("첫 번째-popover")).toBeInTheDocument();
    expect(screen.queryByTestId("두 번째-popover")).not.toBeInTheDocument();
  });

  it("does not steal focus back when a pointer-like outside action dismisses the popover", async () => {
    render(
      <OverlayProvider>
        <PopoverFixture label="검색어" />
      </OverlayProvider>,
    );

    const trigger = screen.getByRole("button", { name: "검색어 열기" });
    const outsideAction = screen.getByRole("button", {
      name: "검색어 바깥 작업",
    });
    await userEvent.click(trigger);
    await userEvent.click(outsideAction);

    expect(screen.queryByTestId("검색어-popover")).not.toBeInTheDocument();
    await waitFor(() => expect(outsideAction).toHaveFocus());
    expect(trigger).not.toHaveFocus();
  });
});
