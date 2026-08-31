import type { Mocked } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { OverlayProvider } from "../overlays/OverlayProvider";
import {
  AuthCommandProvider,
  type AuthCommandPort,
} from "../../features/auth/ports/AuthCommandProvider";
import { useNonModalOverlayRegistration } from "../../shared/ui";
import { UserMenu } from "./UserMenu";

const mockNavigate = vi.fn();
const mockLogout = vi.fn().mockResolvedValue(undefined);
const mockCreateDraft = vi.fn().mockResolvedValue(undefined);

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ hash: "", key: "default", pathname: "/", search: "" }),
  useNavigate: () => mockNavigate,
}));

vi.mock("../session/useSession", () => ({
  useSession: () => ({ logout: mockLogout }),
}));

vi.mock("../../features/accommodations/ui/draftCreate", () => ({
  useCreateAccommodationDraft: () => ({
    createDraft: mockCreateDraft,
    isCreating: false,
  }),
}));

const commands: Mocked<AuthCommandPort> = {
  login: vi.fn().mockResolvedValue(undefined),
  signup: vi.fn().mockResolvedValue(undefined),
  shouldCompleteLoginInCurrentView: vi.fn(() => true),
};

const CompetingPopover = () => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useNonModalOverlayRegistration({
    enabled: isOpen,
    onClose: () => setIsOpen(false),
    overlayRef: popoverRef,
    triggerRef,
  });

  return (
    <>
      <button ref={triggerRef} onClick={() => setIsOpen(true)} type="button">
        보조 메뉴 열기
      </button>
      {isOpen && (
        <div ref={popoverRef} data-testid="competing-popover" tabIndex={-1}>
          <button type="button">보조 메뉴 작업</button>
        </div>
      )}
    </>
  );
};

describe("UserMenu auth modal focus return", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["로그인", "회원가입"] as const)(
    "restores focus to the persistent menu trigger after closing the %s modal",
    async (mode) => {
      render(
        <OverlayProvider>
          <AuthCommandProvider commands={commands}>
            <UserMenu isLoggedIn={false} />
          </AuthCommandProvider>
        </OverlayProvider>,
      );
      const menuButton = screen.getByRole("button", { name: "사용자 메뉴" });

      await userEvent.click(menuButton);
      await userEvent.click(screen.getByRole("menuitem", { name: mode }));

      expect(screen.getByRole("dialog", { name: mode })).toBeInTheDocument();
      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: mode }),
        ).not.toBeInTheDocument();
      });
      await waitFor(() => expect(menuButton).toHaveFocus());
    },
  );

  it("lets the shared overlay stack close the menu and restore its trigger", async () => {
    render(
      <OverlayProvider>
        <AuthCommandProvider commands={commands}>
          <UserMenu isLoggedIn={false} />
        </AuthCommandProvider>
      </OverlayProvider>,
    );
    const menuButton = screen.getByRole("button", { name: "사용자 메뉴" });

    await userEvent.click(menuButton);
    screen.getByRole("menuitem", { name: "로그인" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("menu", { name: "사용자 메뉴" }),
      ).not.toBeInTheDocument();
    });
    expect(menuButton).toHaveFocus();
  });

  it("closes overlays in topmost order and restores each trigger", async () => {
    render(
      <OverlayProvider>
        <AuthCommandProvider commands={commands}>
          <CompetingPopover />
          <UserMenu isLoggedIn={false} />
        </AuthCommandProvider>
      </OverlayProvider>,
    );
    const competingTrigger = screen.getByRole("button", {
      name: "보조 메뉴 열기",
    });
    const menuButton = screen.getByRole("button", { name: "사용자 메뉴" });

    await userEvent.click(competingTrigger);
    await userEvent.click(menuButton);
    screen.getByRole("menuitem", { name: "로그인" }).focus();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("menu", { name: "사용자 메뉴" }),
      ).not.toBeInTheDocument();
    });
    const competingPopover = screen.getByTestId("competing-popover");
    expect(competingPopover).toBeInTheDocument();
    await waitFor(() => expect(competingPopover).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByTestId("competing-popover")).not.toBeInTheDocument();
    });
    await waitFor(() => expect(competingTrigger).toHaveFocus());
  });
});
