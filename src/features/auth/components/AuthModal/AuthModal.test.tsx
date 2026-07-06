import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthModal } from "./AuthModal";

const mockLogin = jest.fn();

jest.mock("../../../../hooks/useAuth", () => ({
  useAuth: () => ({
    login: mockLogin,
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
  beforeEach(() => {
    mockLogin.mockReset();
    mockLogin.mockResolvedValue(undefined);
  });

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

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "비밀번호가 일치하지 않습니다."
    );

    await userEvent.click(within(alert).getByRole("button", { name: "닫기" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("closes and runs the success callback after a completed login while open", async () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    render(
      <AuthModal
        isOpen={true}
        onClose={onClose}
        initialMode="login"
        onSuccess={onSuccess}
      />
    );

    await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("does not replay the success callback when the modal closes before login resolves", async () => {
    let resolveLogin!: () => void;
    mockLogin.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogin = resolve;
      })
    );
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    const { rerender } = render(
      <AuthModal
        isOpen={true}
        onClose={onClose}
        initialMode="login"
        onSuccess={onSuccess}
      />
    );

    await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));

    rerender(
      <AuthModal
        isOpen={false}
        onClose={onClose}
        initialMode="login"
        onSuccess={onSuccess}
      />
    );

    await act(async () => {
      resolveLogin();
      await Promise.resolve();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
