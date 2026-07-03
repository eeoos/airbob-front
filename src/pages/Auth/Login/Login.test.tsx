import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "./Login";

const mockNavigate = jest.fn();
const mockLogin = jest.fn();
let mockLocationState: unknown = null;

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ state: mockLocationState }),
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
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

describe("Login", () => {
  beforeEach(() => {
    mockLocationState = null;
    mockNavigate.mockReset();
    mockLogin.mockReset();
    mockLogin.mockResolvedValue(undefined);
  });

  it("renders the login form with shared UI primitives", () => {
    render(<Login />);

    expect(screen.getByTestId("shared-card")).toBeInTheDocument();
    expect(screen.getAllByTestId("shared-text-field")).toHaveLength(2);
    expect(screen.getAllByTestId("shared-button")).toHaveLength(2);
  });

  it("submits credentials and redirects home when no return target exists", async () => {
    render(<Login />);

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
    mockLocationState = {
      from: {
        pathname: "/profile",
        search: "?mode=host&tab=reservations",
        hash: "#calendar",
      },
    };

    render(<Login />);

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
    render(<Login />);

    await userEvent.click(screen.getByRole("button", { name: "회원가입" }));

    expect(mockNavigate).toHaveBeenCalledWith("/signup");
  });
});
