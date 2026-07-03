import { render, screen } from "@testing-library/react";
import React from "react";
import { Header } from "./Header";

let mockPathname = "/";
let mockSearchParams = new URLSearchParams();
const mockSearchBar = jest.fn();

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

jest.mock("../../features/search/components/SearchBar", () => ({
  SearchBar: (props: { isMapDragMode?: boolean }) => {
    mockSearchBar(props);
    return <div data-testid="search-bar" />;
  },
}));

jest.mock("./UserMenu", () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
  }),
}));

describe("Header", () => {
  beforeEach(() => {
    mockPathname = "/";
    mockSearchParams = new URLSearchParams();
    mockSearchBar.mockClear();
  });

  it("renders the logo as an accessible home link", () => {
    render(<Header />);

    expect(
      screen.getByRole("link", { name: "Airbob 홈으로 이동" })
    ).toHaveAttribute("href", "/");
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
});
