import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "fs";
import React from "react";
import type { SearchBarRoutePort } from "../../features/search/ui/HeaderSearchBar";
import { Header } from "./Header";

let mockPathname = "/";
let mockSearchParams = new URLSearchParams();
const mockSearchBar = jest.fn();
const mockUserMenu = jest.fn();
const mockNavigate = jest.fn();
const mockSetSearchParams = jest.fn();
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
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  }),
  { virtual: true }
);

jest.mock("../../features/search/ui/HeaderSearchBar", () => ({
  ...jest.requireActual("../../features/search/ui/HeaderSearchBar"),
  HeaderSearchBar: (props: {
    isMapDragMode?: boolean;
    routePort: SearchBarRoutePort;
  }) => {
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

jest.mock("../session/useSession", () => ({
  useSession: () => ({
    state: {
      status: mockIsAuthenticated ? "authenticated" : "anonymous",
    },
  }),
}));

describe("Header", () => {
  beforeEach(() => {
    mockPathname = "/";
    mockSearchParams = new URLSearchParams();
    mockIsAuthenticated = false;
    mockSearchBar.mockClear();
    mockUserMenu.mockClear();
    mockNavigate.mockReset();
    mockSetSearchParams.mockReset();
  });

  it("renders the logo as an accessible home link", () => {
    render(<Header />);

    const homeLink = screen.getByRole("link", {
      name: "Airbob 홈으로 이동",
    });
    const logoImage = within(homeLink).getByRole("presentation");

    expect(homeLink).toHaveAttribute("href", "/");
    expect(logoImage).toHaveAttribute("src", "airbob-wordmark.png");
    expect(logoImage).toHaveAttribute("alt", "");
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

  it("centers mobile menu contents in the wrapped header row", () => {
    const css = readFileSync(`${__dirname}/Header.module.css`, "utf8");

    expect(css).toContain(
      [
        "  .menu {",
        "    display: flex;",
        "    align-items: center;",
        "  }",
      ].join("\n")
    );
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

  it("owns push and replace commands behind the search route port", () => {
    mockPathname = "/search";
    mockSearchParams = new URLSearchParams("destination=Seoul&page=2");

    render(<Header />);

    const props = mockSearchBar.mock.calls[0][0] as {
      routePort: SearchBarRoutePort;
    };
    expect(props.routePort.currentSearchParams).toBe(mockSearchParams);
    expect(props.routePort.isSearchRoute).toBe(true);

    props.routePort.pushSearch(
      new URLSearchParams("destination=Busan&adultOccupancy=2"),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      "/search?destination=Busan&adultOccupancy=2",
    );

    const replacement = new URLSearchParams("destination=Seoul");
    props.routePort.replaceSearch(replacement);
    expect(mockSetSearchParams).toHaveBeenCalledWith(replacement, {
      replace: true,
    });
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
