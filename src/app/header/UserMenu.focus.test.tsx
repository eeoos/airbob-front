import type { Mocked } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverlayProvider } from "../overlays/OverlayProvider";
import {
  AuthCommandProvider,
  type AuthCommandPort,
} from "../../features/auth/ports/AuthCommandProvider";
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

vi.mock("../../features/accommodations/ports/draftCreate", () => ({
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
});
