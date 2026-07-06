import { render, screen } from "@testing-library/react";
import React from "react";
import { Header } from "./Header";

let mockPathname = "/";
let mockSearchParams = new URLSearchParams();
const mockSearchBar = jest.fn();
const mockUserMenu = jest.fn();
let mockIsAuthenticated = false;

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({
      children,
      to,
      ...props
    }: {
      children: React.ReactNode;
      to: string;
    }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useLocation: () => ({
      pathname: mockPathname,
    }),
    useNavigate: () => jest.fn(),
    useSearchParams: () => [mockSearchParams, jest.fn()],
  }),
  { virtual: true }
);

jest.mock("../../features/search/appShell", () => ({
  ...jest.requireActual("../../features/search/appShell"),
  HeaderSearchBar: (props: { isMapDragMode?: boolean }) => {
    mockSearchBar(props);
    return <div data-testid="header-search-bar" />;
  },
}));

jest.mock("./UserMenu", () => ({
  UserMenu: (props: { isLoggedIn: boolean }) => {
    mockUserMenu(props);
    return (
      <div
        data-testid="user-menu"
        data-is-logged-in={String(props.isLoggedIn)}
      />
    );
  },
}));

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

describe("Header", () => {
  beforeEach(() => {
    mockPathname = "/";
    mockSearchParams = new URLSearchParams();
    mockIsAuthenticated = false;
    mockSearchBar.mockClear();
    mockUserMenu.mockClear();
  });

  it("renders the logo as an accessible home link", () => {
    render(<Header />);

    expect(
      screen.getByRole("link", { name: "Airbob 홈으로 이동" })
    ).toHaveAttribute("href", "/");
  });

  it("renders one logical search bar for searchable header modes", () => {
    mockPathname = "/search";

    render(<Header headerMode="search" />);

    expect(screen.getAllByTestId("header-search-bar")).toHaveLength(1);
  });

  it("renders no logical search bars for hidden header mode", () => {
    render(<Header headerMode="hidden" />);

    expect(screen.queryAllByTestId("header-search-bar")).toHaveLength(0);
  });

  it("passes map drag mode only when all viewport params are valid", () => {
    mockPathname = "/search";
    mockSearchParams = new URLSearchParams(
      "topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128"
    );

    render(<Header />);

    expect(mockSearchBar).toHaveBeenCalledWith(
      expect.objectContaining({ isMapDragMode: true })
    );
  });

  it("does not pass map drag mode for partial viewport params", () => {
    mockPathname = "/search";
    mockSearchParams = new URLSearchParams("topLeftLat=38&topLeftLng=126");

    render(<Header />);

    expect(mockSearchBar).toHaveBeenCalledWith(
      expect.objectContaining({ isMapDragMode: false })
    );
  });

  it("passes authentication state to the user menu", () => {
    mockIsAuthenticated = true;

    render(<Header />);

    expect(mockUserMenu).toHaveBeenCalledWith({ isLoggedIn: true });
    expect(screen.getByTestId("user-menu")).toHaveAttribute(
      "data-is-logged-in",
      "true"
    );
  });
});
