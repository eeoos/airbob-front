import React from "react";
import { render, screen } from "@testing-library/react";
import Login from "./Login";

const mockNavigate = jest.fn();
const mockLoginRoute = jest.fn();
let mockLocationState: unknown = null;

jest.mock(
  "react-router-dom",
  () => ({
    useLocation: () => ({ state: mockLocationState }),
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock("../../../features/auth", () => {
  const React = require("react");

  return {
    LoginRoute: (props: unknown) => {
      mockLoginRoute(props);
      return React.createElement("div", { "data-testid": "login-route" });
    },
  };
});

describe("Login", () => {
  beforeEach(() => {
    mockLocationState = null;
    mockNavigate.mockReset();
    mockLoginRoute.mockReset();
  });

  it("passes location state and navigate into LoginRoute", () => {
    const locationState = {
      from: {
        pathname: "/profile",
        search: "?mode=host&tab=reservations",
        hash: "#calendar",
      },
    };
    mockLocationState = locationState;

    render(<Login />);

    expect(screen.getByTestId("login-route")).toBeInTheDocument();
    expect(mockLoginRoute).toHaveBeenCalledWith({
      locationState,
      navigate: mockNavigate,
    });
  });
});
