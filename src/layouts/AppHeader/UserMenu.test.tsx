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
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(screen.getByRole("dialog", { name: "login" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "로그인" })
    ).not.toBeInTheDocument();
  });

  it("opens the signup modal from the unauthenticated menu", async () => {
    render(<UserMenu isLoggedIn={false} />);

    await openMenu();
    await userEvent.click(screen.getByRole("button", { name: "회원가입" }));

    expect(screen.getByRole("dialog", { name: "signup" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "회원가입" })
    ).not.toBeInTheDocument();
  });

  it("shows authenticated wishlist, profile, hosting, and logout actions", async () => {
    render(<UserMenu isLoggedIn />);

    expect(screen.getByRole("button", { name: "프로필" })).toBeInTheDocument();

    await openMenu();

    expect(screen.getByRole("button", { name: "위시리스트" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "프로필" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "호스팅 하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });

  it("closes the menu on outside click", async () => {
    render(<UserMenu isLoggedIn />);

    await openMenu();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "로그아웃" })
      ).not.toBeInTheDocument();
    });
  });

  it("logs out and navigates home", async () => {
    render(<UserMenu isLoggedIn />);

    await openMenu();
    await userEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("creates a hosting draft and navigates to the accommodation create editor", async () => {
    render(<UserMenu isLoggedIn />);

    await openMenu();
    await userEvent.click(screen.getByRole("button", { name: "호스팅 하기" }));

    await waitFor(() => {
      expect(mockCreateDraft).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/accommodations/987/edit?mode=create");
    expect(mockHandleError).not.toHaveBeenCalled();
  });
});
