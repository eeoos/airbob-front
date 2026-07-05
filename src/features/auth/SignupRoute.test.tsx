import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NavigateFunction } from "react-router-dom";
import { SignupRoute } from "./SignupRoute";

const mockNavigate = jest.fn();
const mockSignup = jest.fn();
const mockClearError = jest.fn();
let mockSignupError: string | null = null;
let mockIsLoading = false;

jest.mock("./hooks/useSignup", () => ({
  useSignup: () => ({
    error: mockSignupError,
    clearError: mockClearError,
    isLoading: mockIsLoading,
    signup: mockSignup,
  }),
}));

jest.mock("../../components/ErrorToast", () => ({
  ErrorToast: ({
    message,
    onClose,
  }: {
    message: string;
    onClose: () => void;
  }) => (
    <div role="alert">
      <span>{message}</span>
      <button type="button" onClick={onClose}>
        닫기
      </button>
    </div>
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

const renderSignupRoute = () =>
  render(<SignupRoute navigate={mockNavigate as unknown as NavigateFunction} />);

describe("SignupRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSignup.mockReset();
    mockClearError.mockReset();
    mockSignup.mockResolvedValue(true);
    mockSignupError = null;
    mockIsLoading = false;
  });

  it("renders the signup form", () => {
    renderSignupRoute();

    expect(screen.getByLabelText("닉네임")).toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호 확인")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "회원가입" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
  });

  it("submits signup data through useSignup and redirects to login on success", async () => {
    renderSignupRoute();

    await userEvent.type(screen.getByLabelText("닉네임"), "airbob");
    await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.type(screen.getByLabelText("비밀번호 확인"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "회원가입" }));

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith({
        nickname: "airbob",
        email: "user@example.com",
        password: "password123",
        confirmPassword: "password123",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("keeps the login navigation link", async () => {
    renderSignupRoute();

    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
