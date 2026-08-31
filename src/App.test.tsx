import { render, screen, within } from "@testing-library/react";
import App from "./App";

jest.mock("./app/router/Router", () => ({
  AppRouteTree: ({
    renderAuthenticated,
    renderHeader,
  }: {
    renderAuthenticated: (content: React.ReactElement) => React.ReactElement;
    renderHeader: (mode: "default" | "search") => React.ReactNode;
  }) => (
    <div data-testid="app-router">
      {renderHeader("search")}
      {renderAuthenticated(<div data-testid="route-content">Route</div>)}
    </div>
  ),
}));

jest.mock("./app/header", () => ({
  Header: ({ headerMode }: { headerMode: string }) => (
    <header data-testid="app-header">{headerMode}</header>
  ),
}));

jest.mock("./app/router/RequireAuthenticatedRoute", () => ({
  RequireAuthenticatedRoute: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-boundary">{children}</div>
  ),
}));

describe("App composition", () => {
  it("injects the current header and authentication boundaries into the stable route tree", () => {
    render(<App />);

    const router = screen.getByTestId("app-router");

    expect(within(router).getByTestId("app-header")).toHaveTextContent(
      "search",
    );
    expect(within(router).getByTestId("auth-boundary")).toContainElement(
      within(router).getByTestId("route-content"),
    );
  });
});
