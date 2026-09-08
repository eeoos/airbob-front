import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createEmptyAuthForm } from "../../features/auth/model/auth";
import type { AuthFormController } from "../../features/auth/model/authForm";
import { AuthScreen } from "./AuthScreen";

const createForm = (
  overrides: Partial<AuthFormController> = {},
): AuthFormController => ({
  values: createEmptyAuthForm(),
  error: null,
  isLoading: false,
  clearError: vi.fn(),
  reset: vi.fn(),
  setField: vi.fn(),
  submit: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe("AuthScreen", () => {
  it("presents page-level account orientation with one h1", () => {
    render(
      <AuthScreen
        form={createForm()}
        mode="login"
        onAlternate={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "로그인", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("저장한 숙소와 예약 내역을 이어서 확인하세요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "로그인 양식" })).toHaveAttribute(
      "aria-describedby",
      "auth-screen-intro",
    );
  });

  it("keeps the error toast contract and adds inline retry context", () => {
    render(
      <AuthScreen
        form={createForm({
          error: "이메일 또는 비밀번호가 올바르지 않습니다.",
        })}
        mode="login"
        onAlternate={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
    expect(screen.getByTestId("auth-inline-error")).toHaveTextContent(
      "입력 내용을 확인하고 다시 시도해 주세요.",
    );
    expect(screen.getByRole("form", { name: "로그인 양식" })).toHaveAttribute(
      "aria-describedby",
      "auth-screen-intro auth-screen-error-context",
    );
    expect(screen.getByRole("button", { name: "다시 로그인" })).toBeEnabled();
  });

  it("announces pending work on the form action", () => {
    render(
      <AuthScreen
        form={createForm({ isLoading: true })}
        mode="signup"
        onAlternate={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("form", { name: "회원가입 양식" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "가입하는 중…" })).toBeDisabled();
  });

  it("preserves the alternate account-entry action", async () => {
    const onAlternate = vi.fn();
    render(
      <AuthScreen
        form={createForm()}
        mode="signup"
        onAlternate={onAlternate}
        onSubmit={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(onAlternate).toHaveBeenCalledTimes(1);
  });
});
