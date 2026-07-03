import { render, screen } from "@testing-library/react";
import React from "react";
import { Header } from "./Header";

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
      pathname: "/",
    }),
    useNavigate: () => jest.fn(),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
  }),
  { virtual: true }
);

jest.mock("../../features/search/components/SearchBar", () => ({
  SearchBar: () => <div data-testid="search-bar" />,
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
  it("renders the logo as an accessible home link", () => {
    render(<Header />);

    expect(
      screen.getByRole("link", { name: "Airbob 홈으로 이동" })
    ).toHaveAttribute("href", "/");
  });
});
