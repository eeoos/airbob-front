import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthModal } from "./AuthModal";

jest.mock("../../../../hooks/useAuth", () => ({
  useAuth: () => ({
    login: jest.fn(),
  }),
}));

jest.mock("../../../../hooks/useApiError", () => {
  const React = require("react");

  return {
    useApiError: () => {
      const [error, setError] = React.useState(null as string | null);
      const clearError = React.useCallback(() => setError(null), []);
      const handleError = React.useCallback((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }, []);

      return {
        error,
        clearError,
        handleError,
      };
    },
  };
});

jest.mock("../../hooks/useSignup", () => {
  const React = require("react");

  return {
    useSignup: () => {
      const [error, setError] = React.useState(null as string | null);
      const clearError = React.useCallback(() => setError(null), []);
      const signup = React.useCallback(async () => {
        setError("비밀번호가 일치하지 않습니다.");
        return false;
      }, []);

      return {
        error,
        clearError,
        isLoading: false,
        signup,
      };
    },
  };
});

jest.mock("../../../../components/ErrorToast", () => ({
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

describe("AuthModal", () => {
  it("renders the login form inside the shared accessible dialog", () => {
    render(
      <AuthModal isOpen={true} onClose={jest.fn()} initialMode="login" />
    );

    expect(screen.getByRole("dialog", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("dismisses signup errors when the toast closes", async () => {
    render(
      <AuthModal isOpen={true} onClose={jest.fn()} initialMode="signup" />
    );

    await userEvent.type(screen.getByLabelText("닉네임"), "airbob");
    await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.type(screen.getByLabelText("비밀번호 확인"), "different123");
    await userEvent.click(screen.getByRole("button", { name: "회원가입" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "비밀번호가 일치하지 않습니다."
    );

    await userEvent.click(
      screen.getByRole("alert").querySelector("button") as HTMLButtonElement
    );

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
