import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiClientError } from "../../../../api/response";
import {
  SessionContext,
  SessionProvider,
  type SessionContextValue,
} from "../../../../app/session/SessionProvider";
import type { SessionState } from "../../../../app/session/sessionState";
import { AuthProvider } from "../../../../contexts/AuthContext";
import type { SessionAuthPort } from "../../ports/sessionPort";
import { AuthModal } from "./AuthModal";

const mockLogin = jest.fn();

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

const anonymousState: SessionState = {
  status: "anonymous",
  reason: "bootstrap",
  revocation: "verified",
  operationId: 0,
  epoch: 0,
};

const compatibilitySession: SessionContextValue = {
  state: anonymousState,
  login: mockLogin,
  logout: jest.fn(),
  revalidate: jest.fn(),
  retryServerLogout: jest.fn(),
  captureAuthenticatedSession: jest.fn(() => null),
  isCurrentSession: jest.fn(),
};

const AuthCompatibilityWrapper = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <SessionContext.Provider value={compatibilitySession}>
    <AuthProvider>{children}</AuthProvider>
  </SessionContext.Provider>
);

const renderAuthModal = (element: React.ReactElement) =>
  render(element, { wrapper: AuthCompatibilityWrapper });

const authenticationError = () =>
  new ApiClientError({
    status: 401,
    code: "M004",
    message: "Authentication is required.",
  });

const createAuthPort = (): jest.Mocked<SessionAuthPort> => ({
  getViewer: jest.fn<Promise<never>, [AbortSignal?]>(),
  login: jest.fn<Promise<void>, Parameters<SessionAuthPort["login"]>>(),
  logout: jest.fn<Promise<void>, [AbortSignal?]>(() => Promise.resolve()),
});

function AppOwnedLoginModal() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        로그인 모달 열기
      </button>
      <AuthModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

describe("AuthModal", () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockLogin.mockResolvedValue(undefined);
    jest
      .mocked(compatibilitySession.captureAuthenticatedSession)
      .mockReturnValue(null);
  });

  it("renders the login form inside the shared accessible dialog", () => {
    renderAuthModal(
      <AuthModal isOpen={true} onClose={jest.fn()} initialMode="login" />
    );

    expect(screen.getByRole("dialog", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("dismisses signup errors when the toast closes", async () => {
    renderAuthModal(
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

    renderAuthModal(
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
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
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
    const { rerender } = renderAuthModal(
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

  it("keeps app-owned modal intent when an anonymous login command fails", async () => {
    const loginFailure = new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    const authPort = createAuthPort();
    authPort.login.mockRejectedValueOnce(loginFailure);
    authPort.getViewer.mockRejectedValueOnce(authenticationError());

    render(
      <SessionProvider authPort={authPort} initialState={anonymousState}>
        <AuthProvider>
          <AppOwnedLoginModal />
        </AuthProvider>
      </SessionProvider>
    );

    await userEvent.click(
      screen.getByRole("button", { name: "로그인 모달 열기" })
    );
    await userEvent.type(screen.getByLabelText("이메일"), "guest@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(authPort.login).toHaveBeenCalledTimes(1));

    expect(screen.getByRole("dialog", { name: "로그인" })).toBeInTheDocument();
  });

  it("preserves the form and exact error after a failed login verifies anonymous", async () => {
    const loginFailure = new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    const authPort = createAuthPort();
    authPort.login.mockRejectedValueOnce(loginFailure);
    authPort.getViewer.mockRejectedValueOnce(authenticationError());

    render(
      <SessionProvider authPort={authPort} initialState={anonymousState}>
        <AuthProvider>
          <AuthModal isOpen={true} onClose={jest.fn()} />
        </AuthProvider>
      </SessionProvider>
    );

    await userEvent.type(screen.getByLabelText("이메일"), "guest@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(authPort.login).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(1));
    const alert = screen.getByRole("alert");

    expect({
      email: (screen.getByLabelText("이메일") as HTMLInputElement).value,
      error: within(alert).getByText(loginFailure.message).textContent,
      password: (screen.getByLabelText("비밀번호") as HTMLInputElement).value,
    }).toEqual({
      email: "guest@example.com",
      error: loginFailure.message,
      password: "wrong-password",
    });
  });

  it("does not execute a success callback captured by the previous query generation", async () => {
    const authPort = createAuthPort();
    const onSuccess = jest.fn();
    authPort.login.mockResolvedValueOnce(undefined);
    authPort.getViewer.mockResolvedValueOnce({
      id: 8,
      email: "next@example.invalid",
      nickname: "Next",
      thumbnail_image_url: null,
    });

    render(
      <SessionProvider authPort={authPort} initialState={anonymousState}>
        <AuthProvider>
          <AuthModal
            isOpen={true}
            onClose={jest.fn()}
            onSuccess={onSuccess}
          />
        </AuthProvider>
      </SessionProvider>,
    );

    await userEvent.type(screen.getByLabelText("이메일"), "next@example.invalid");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(authPort.getViewer).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });
});
