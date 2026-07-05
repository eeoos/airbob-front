import React from "react";
import { render, screen } from "@testing-library/react";
import Signup from "./Signup";

const mockNavigate = jest.fn();
const mockSignupRoute = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock("../../../features/auth", () => {
  const React = require("react");

  return {
    SignupRoute: (props: unknown) => {
      mockSignupRoute(props);
      return React.createElement("div", { "data-testid": "signup-route" });
    },
  };
});

describe("Signup", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSignupRoute.mockReset();
  });

  it("passes navigate into SignupRoute", () => {
    render(<Signup />);

    expect(screen.getByTestId("signup-route")).toBeInTheDocument();
    expect(mockSignupRoute).toHaveBeenCalledWith({
      navigate: mockNavigate,
    });
  });
});
