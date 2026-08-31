import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCreateAccommodationDraft } from "../../features/accommodations/ports/draftCreate";
import { AppError } from "../../platform/http/errors";
import { UserMenu } from "./UserMenu";

const mockNavigate = jest.fn();
const mockLogout = jest.fn();
const mockCreateDraft = jest.fn();
const mockClientLogError = jest.fn();
const mockLocation = {
  hash: "",
  key: "user-menu-entry",
  pathname: "/",
  search: "",
};
let capturedDraftError: ((error: unknown) => void) | null = null;

jest.mock(
  "react-router-dom",
  () => ({
    useLocation: () => mockLocation,
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock("../session/useSession", () => ({
  useSession: () => ({
    logout: mockLogout,
  }),
}));

jest.mock("../../features/accommodations/ports/draftCreate", () => ({
  useCreateAccommodationDraft: jest.fn(),
}));

jest.mock("../../platform/logging/clientLogger", () => ({
  clientLogger: {
    error: (...args: unknown[]) => mockClientLogError(...args),
  },
}));

jest.mock("../../features/auth/public", () => ({
  AuthModal: ({
    initialMode,
    isOpen,
  }: {
    initialMode: "login" | "signup";
    isOpen: boolean;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={initialMode}>
        {initialMode}
      </div>
    ) : null,
}));

const mockUseCreateAccommodationDraft = jest.mocked(useCreateAccommodationDraft);

const openMenu = async () => {
  await userEvent.click(screen.getByRole("button", { name: "사용자 메뉴" }));
};

const expectMenuItemsToBeButtonElements = (itemNames: string[]) => {
  itemNames.forEach((name) => {
    const menuItem = screen.getByRole("menuitem", { name });

    expect(menuItem.tagName).toBe("BUTTON");
    expect(menuItem).toHaveAttribute("type", "button");
  });
};

describe("UserMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({ key: mockLocation.key }, "", "/");
    capturedDraftError = null;
    mockLogout.mockResolvedValue(undefined);
    mockUseCreateAccommodationDraft.mockImplementation(({ onCreated, onError }) => {
      capturedDraftError = onError;
      mockCreateDraft.mockImplementation(async () => {
        onCreated(987);
      });

      return {
        createDraft: mockCreateDraft,
        isCreating: false,
      };
    });
  });

  it("opens the login modal from the unauthenticated menu", async () => {
    render(<UserMenu isLoggedIn={false} />);

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "로그인" }));

    expect(screen.getByRole("dialog", { name: "login" })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "로그인" })
    ).not.toBeInTheDocument();
  });

  it("opens the signup modal from the unauthenticated menu", async () => {
    render(<UserMenu isLoggedIn={false} />);

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "회원가입" }));

    expect(screen.getByRole("dialog", { name: "signup" })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "회원가입" })
    ).not.toBeInTheDocument();
  });

  it("renders guest menu items as non-submit buttons", async () => {
    render(<UserMenu isLoggedIn={false} />);

    await openMenu();

    expectMenuItemsToBeButtonElements(["로그인", "회원가입"]);
  });

  it("shows authenticated wishlist, profile, hosting, and logout actions", async () => {
    render(<UserMenu isLoggedIn />);

    expect(screen.getByRole("button", { name: "프로필" })).toBeInTheDocument();

    await openMenu();

    expect(screen.getByRole("menuitem", { name: "위시리스트" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "프로필" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "프로필" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "호스팅 하기" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "로그아웃" })).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("renders authenticated menu items as non-submit buttons", async () => {
    render(<UserMenu isLoggedIn />);

    await openMenu();

    expectMenuItemsToBeButtonElements([
      "위시리스트",
      "프로필",
      "호스팅 하기",
      "로그아웃",
    ]);
  });

  it("connects the menu button to a named menu and closes on Escape", async () => {
    render(<UserMenu isLoggedIn={false} />);

    const menuButton = screen.getByRole("button", { name: "사용자 메뉴" });
    await userEvent.click(menuButton);

    const menu = screen.getByRole("menu", { name: "사용자 메뉴" });
    expect(menuButton).toHaveAttribute("aria-controls", menu.id);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(menuButton).toHaveAttribute("aria-haspopup", "menu");

    fireEvent.keyDown(menuButton, { key: "Escape" });

    expect(screen.queryByRole("menu", { name: "사용자 메뉴" })).not.toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it.each([
    ["ArrowDown", "위시리스트"],
    ["Enter", "위시리스트"],
    [" ", "위시리스트"],
    ["ArrowUp", "로그아웃"],
  ])("opens the menu with %s and focuses %s", async (key, focusedItemName) => {
    render(<UserMenu isLoggedIn />);

    const menuButton = screen.getByRole("button", { name: "사용자 메뉴" });
    menuButton.focus();
    expect(menuButton).toHaveFocus();

    fireEvent.keyDown(menuButton, { key });

    expect(screen.getByRole("menu", { name: "사용자 메뉴" })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("menuitem", { name: focusedItemName }),
      ).toHaveFocus();
    });
  });

  it("moves focus through menu items with menu navigation keys", async () => {
    render(<UserMenu isLoggedIn />);

    const menuButton = screen.getByRole("button", { name: "사용자 메뉴" });
    await userEvent.click(menuButton);

    const wishlistItem = screen.getByRole("menuitem", { name: "위시리스트" });
    const profileItem = screen.getByRole("menuitem", { name: "프로필" });
    const hostingItem = screen.getByRole("menuitem", { name: "호스팅 하기" });
    const logoutItem = screen.getByRole("menuitem", { name: "로그아웃" });

    fireEvent.keyDown(menuButton, { key: "ArrowDown" });
    expect(wishlistItem).toHaveFocus();

    fireEvent.keyDown(wishlistItem, { key: "ArrowDown" });
    expect(profileItem).toHaveFocus();

    fireEvent.keyDown(profileItem, { key: "End" });
    expect(logoutItem).toHaveFocus();

    fireEvent.keyDown(logoutItem, { key: "Home" });
    expect(wishlistItem).toHaveFocus();

    fireEvent.keyDown(wishlistItem, { key: "ArrowUp" });
    expect(logoutItem).toHaveFocus();

    fireEvent.keyDown(logoutItem, { key: "ArrowUp" });
    expect(hostingItem).toHaveFocus();
  });

  it("returns focus to the menu button when Escape closes the menu from a menu item", async () => {
    render(<UserMenu isLoggedIn={false} />);

    const menuButton = screen.getByRole("button", { name: "사용자 메뉴" });
    await userEvent.click(menuButton);

    const loginItem = screen.getByRole("menuitem", { name: "로그인" });
    loginItem.focus();
    expect(loginItem).toHaveFocus();

    fireEvent.keyDown(loginItem, { key: "Escape" });

    expect(screen.queryByRole("menu", { name: "사용자 메뉴" })).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  it("closes the menu on Tab from a menu item without restoring trigger focus", async () => {
    render(<UserMenu isLoggedIn={false} />);

    const menuButton = screen.getByRole("button", { name: "사용자 메뉴" });
    await userEvent.click(menuButton);

    const loginItem = screen.getByRole("menuitem", { name: "로그인" });
    loginItem.focus();
    expect(loginItem).toHaveFocus();

    const tabWasNotCanceled = fireEvent.keyDown(loginItem, { key: "Tab" });

    expect(tabWasNotCanceled).toBe(true);
    expect(screen.queryByRole("menu", { name: "사용자 메뉴" })).not.toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(menuButton).not.toHaveFocus();
  });

  it("closes a click-opened menu on Tab from the trigger", async () => {
    render(<UserMenu isLoggedIn={false} />);

    const menuButton = screen.getByRole("button", { name: "사용자 메뉴" });
    await userEvent.click(menuButton);
    expect(menuButton).toHaveFocus();
    expect(screen.getByRole("menu", { name: "사용자 메뉴" })).toBeInTheDocument();

    const tabWasNotCanceled = fireEvent.keyDown(menuButton, { key: "Tab" });

    expect(tabWasNotCanceled).toBe(true);
    expect(screen.queryByRole("menu", { name: "사용자 메뉴" })).not.toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the menu on outside click", async () => {
    render(<UserMenu isLoggedIn />);

    await openMenu();
    expect(screen.getByRole("menuitem", { name: "로그아웃" })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole("menuitem", { name: "로그아웃" })
      ).not.toBeInTheDocument();
    });
  });

  it("logs out and navigates home", async () => {
    render(<UserMenu isLoggedIn />);

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "로그아웃" }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("does not let a late logout completion override newer navigation", async () => {
    let resolveLogout!: () => void;
    const pendingLogout = new Promise<void>((resolve) => {
      resolveLogout = resolve;
    });
    mockLogout.mockReturnValueOnce(pendingLogout);
    render(<UserMenu isLoggedIn />);

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "로그아웃" }));
    window.history.pushState({ key: "new-entry" }, "", "/search");
    await act(async () => {
      resolveLogout();
      await pendingLogout;
      await Promise.resolve();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("creates a hosting draft and navigates to the accommodation create editor", async () => {
    render(<UserMenu isLoggedIn />);

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "호스팅 하기" }));

    await waitFor(() => {
      expect(mockCreateDraft).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/accommodations/987/edit", {
      state: {
        accommodationEdit: {
          accommodationId: "987",
          source: "created-draft",
        },
      },
    });
    expect(mockClientLogError).not.toHaveBeenCalled();
  });

  it("does not navigate when a draft finishes after the user changes route", async () => {
    let resolveDraft!: () => void;
    const pendingDraft = new Promise<void>((resolve) => {
      resolveDraft = resolve;
    });
    mockUseCreateAccommodationDraft.mockImplementation(({ onCreated }) => ({
      createDraft: async () => {
        await pendingDraft;
        onCreated(987);
      },
      isCreating: true,
    }));
    render(<UserMenu isLoggedIn />);

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "호스팅 하기" }));
    window.history.pushState({ key: "new-entry" }, "", "/search");
    await act(async () => {
      resolveDraft();
      await pendingDraft;
      await Promise.resolve();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("logs only safe AppError metadata for an invisible draft failure", () => {
    render(<UserMenu isLoggedIn />);
    const error = new AppError({
      kind: "server",
      code: "DRAFT_CREATE_FAILED",
      message: "The draft could not be created.",
      status: 503,
      retryable: true,
      cause: { secret: "backend-detail-canary" },
    });

    capturedDraftError?.(error);
    capturedDraftError?.(new Error("raw-detail-canary"));

    expect(mockClientLogError).toHaveBeenCalledTimes(1);
    expect(mockClientLogError).toHaveBeenCalledWith({
      message: "Accommodation draft creation failed.",
      error: {
        code: "DRAFT_CREATE_FAILED",
        kind: "server",
        status: 503,
      },
    });
    expect(JSON.stringify(mockClientLogError.mock.calls)).not.toContain(
      "backend-detail-canary",
    );
    expect(JSON.stringify(mockClientLogError.mock.calls)).not.toContain(
      "raw-detail-canary",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
