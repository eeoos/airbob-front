import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NavigateFunction } from "react-router-dom";
import { LoginRoute } from "./LoginRoute";

const mockNavigate = jest.fn();
const mockLogin = jest.fn();
const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

jest.mock("../../components/ErrorToast", () => ({
  ErrorToast: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

jest.mock("../../shared/ui", () => {
  const React = require("react");

  return {
    Button: ({
      children,
      fullWidth,
      isLoading,
      loadingLabel,
      size,
      variant,
      ...props
    }: any) =>
      React.createElement(
        "button",
        {
          ...props,
          disabled: props.disabled || isLoading,
        },
        isLoading ? loadingLabel : children
      ),
    Card: ({ as, children, interactive, padding, ...props }: any) => {
      const Component = as || "section";
      return React.createElement(Component, props, children);
    },
    TextField: ({ error, hint, label, ...props }: any) =>
      React.createElement(
        "label",
        null,
        label,
        React.createElement("input", { ...props, "aria-label": label })
      ),
  };
});

const renderLoginRoute = (locationState: unknown = null) =>
  render(
    <LoginRoute
      locationState={locationState}
      navigate={mockNavigate as unknown as NavigateFunction}
    />
  );

describe("LoginRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogin.mockReset();
    mockClearError.mockReset();
    mockHandleError.mockReset();
    mockLogin.mockResolvedValue(undefined);
  });

  it("renders the login form", () => {
    renderLoginRoute();

    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "회원가입" })
    ).toBeInTheDocument();
  });

  it("submits credentials through useAuth and redirects home", async () => {
    renderLoginRoute();

    await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("redirects to the protected route return target after login", async () => {
    renderLoginRoute({
      from: {
        pathname: "/profile",
        search: "?mode=host&tab=reservations",
        hash: "#calendar",
      },
    });

    await userEvent.type(screen.getByLabelText("이메일"), "host@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/profile?mode=host&tab=reservations#calendar"
      );
    });
  });

  it("keeps the signup navigation link", async () => {
    renderLoginRoute();

    await userEvent.click(screen.getByRole("button", { name: "회원가입" }));

    expect(mockNavigate).toHaveBeenCalledWith("/signup");
  });
});
