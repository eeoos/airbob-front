import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authApi } from "../../../api";
import Signup from "./Signup";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../../../api", () => ({
  authApi: {
    signup: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => {
  const React = require("react");

  return {
    useApiError: () => {
      const [error, setError] = React.useState(null as string | null);

      return {
        error,
        clearError: () => setError(null),
        handleError: (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          return message;
        },
      };
    },
  };
});

jest.mock("../../../components/ErrorToast", () => ({
  ErrorToast: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

jest.mock("../../../shared/ui", () => {
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
          "data-testid": "shared-button",
          disabled: props.disabled || isLoading,
        },
        isLoading ? loadingLabel : children
      ),
    Card: ({ as, children, interactive, padding, ...props }: any) => {
      const Component = as || "section";
      return React.createElement(
        Component,
        { ...props, "data-testid": "shared-card" },
        children
      );
    },
    TextField: ({ error, hint, label, ...props }: any) =>
      React.createElement(
        "label",
        { "data-testid": "shared-text-field" },
        label,
        React.createElement("input", { ...props, "aria-label": label })
      ),
  };
});

describe("Signup", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    jest.mocked(authApi.signup).mockReset();
    jest.mocked(authApi.signup).mockResolvedValue(undefined);
  });

  it("renders the signup form with shared UI primitives", () => {
    render(<Signup />);

    expect(screen.getByTestId("shared-card")).toBeInTheDocument();
    expect(screen.getAllByTestId("shared-text-field")).toHaveLength(4);
    expect(screen.getAllByTestId("shared-button")).toHaveLength(2);
  });

  it("submits signup data and keeps the existing login redirect", async () => {
    render(<Signup />);

    await userEvent.type(screen.getByLabelText("닉네임"), "airbob");
    await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.type(screen.getByLabelText("비밀번호 확인"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "회원가입" }));

    await waitFor(() => {
      expect(authApi.signup).toHaveBeenCalledWith({
        nickname: "airbob",
        email: "user@example.com",
        password: "password123",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("keeps the existing password mismatch validation", async () => {
    render(<Signup />);

    await userEvent.type(screen.getByLabelText("닉네임"), "airbob");
    await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.type(screen.getByLabelText("비밀번호 확인"), "different123");
    await userEvent.click(screen.getByRole("button", { name: "회원가입" }));

    expect(authApi.signup).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "비밀번호가 일치하지 않습니다."
    );
  });

  it("keeps the login navigation link", async () => {
    render(<Signup />);

    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
