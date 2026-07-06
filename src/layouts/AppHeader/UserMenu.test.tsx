import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCreateAccommodationDraft } from "../../features/accommodations/appShell";
import { UserMenu } from "./UserMenu";

const mockNavigate = jest.fn();
const mockLogout = jest.fn();
const mockHandleError = jest.fn();
const mockCreateDraft = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}));

jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({
    handleError: mockHandleError,
  }),
}));

jest.mock("../../features/accommodations/appShell", () => ({
  useCreateAccommodationDraft: jest.fn(),
}));

jest.mock("../../features/auth/appShell", () => ({
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
    mockLogout.mockResolvedValue(undefined);
    mockUseCreateAccommodationDraft.mockImplementation(({ onCreated }) => {
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

  it("creates a hosting draft and navigates to the accommodation create editor", async () => {
    render(<UserMenu isLoggedIn />);

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "호스팅 하기" }));

    await waitFor(() => {
      expect(mockCreateDraft).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/accommodations/987/edit?mode=create");
    expect(mockHandleError).not.toHaveBeenCalled();
  });
});
