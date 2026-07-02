import React from "react";
import { render, screen } from "@testing-library/react";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("connects the label to the input", () => {
    render(<TextField label="이메일" name="email" />);

    expect(screen.getByLabelText("이메일")).toHaveAttribute("name", "email");
  });

  it("uses an explicit id when provided", () => {
    render(<TextField id="login-password" label="비밀번호" type="password" />);

    expect(screen.getByLabelText("비밀번호")).toHaveAttribute(
      "id",
      "login-password"
    );
  });

  it("announces hint text through aria-describedby", () => {
    render(<TextField label="이름" hint="실명으로 입력해주세요." />);

    const input = screen.getByLabelText("이름");
    const hint = screen.getByText("실명으로 입력해주세요.");

    expect(input).toHaveAttribute("aria-describedby", hint.id);
  });

  it("announces error text and marks the field invalid", () => {
    render(<TextField label="이메일" error="이메일 형식이 아닙니다." />);

    const input = screen.getByLabelText("이메일");
    const error = screen.getByText("이메일 형식이 아닙니다.");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", error.id);
  });

  it("preserves caller-provided aria-describedby values", () => {
    render(
      <>
        <p id="external-help">외부 도움말</p>
        <TextField
          label="전화번호"
          hint="예약 안내를 받을 번호입니다."
          aria-describedby="external-help"
        />
      </>
    );

    const input = screen.getByLabelText("전화번호");
    const hint = screen.getByText("예약 안내를 받을 번호입니다.");

    expect(input).toHaveAttribute(
      "aria-describedby",
      `external-help ${hint.id}`
    );
  });
});
