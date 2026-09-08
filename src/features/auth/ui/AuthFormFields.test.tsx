import { fireEvent, render, screen } from "@testing-library/react";
import { createEmptyAuthForm } from "../model/auth";
import { AuthFormFields } from "./AuthFormFields";

describe("AuthFormFields", () => {
  it("uses account-entry autocomplete semantics for login", () => {
    render(
      <AuthFormFields
        idPrefix="login"
        mode="login"
        values={createEmptyAuthForm()}
        onFieldChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("이메일")).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByLabelText("이메일")).toHaveAttribute(
      "inputmode",
      "email",
    );
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("uses profile and new-password autocomplete semantics for signup", () => {
    render(
      <AuthFormFields
        idPrefix="signup"
        mode="signup"
        values={createEmptyAuthForm()}
        onFieldChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("닉네임")).toHaveAttribute(
      "autocomplete",
      "nickname",
    );
    expect(screen.getByLabelText("이메일")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText("비밀번호 확인")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByText("8~20자로 입력해 주세요.")).toBeInTheDocument();
  });

  it("reports edited values through the existing field contract", () => {
    const onFieldChange = vi.fn();
    render(
      <AuthFormFields
        idPrefix="login"
        mode="login"
        values={createEmptyAuthForm()}
        onFieldChange={onFieldChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "guest@example.com" },
    });

    expect(onFieldChange).toHaveBeenCalledWith("email", "guest@example.com");
  });
});
