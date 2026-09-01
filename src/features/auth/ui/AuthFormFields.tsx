import { TextField } from "../../../shared/ui";
import type { AuthFormField, AuthFormValues, AuthMode } from "../model/auth";

export interface AuthFormFieldsProps {
  readonly idPrefix: string;
  readonly mode: AuthMode;
  readonly values: AuthFormValues;
  readonly inputClassName?: string;
  onFieldChange(field: AuthFormField, value: string): void;
}

export function AuthFormFields({
  idPrefix,
  inputClassName,
  mode,
  onFieldChange,
  values,
}: AuthFormFieldsProps) {
  const fieldProps = (field: AuthFormField) => ({
    id: `${idPrefix}-${field}`,
    name: field,
    value: values[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      onFieldChange(field, event.target.value),
    ...(inputClassName ? { className: inputClassName } : {}),
  });

  return (
    <>
      {mode === "signup" && (
        <TextField
          {...fieldProps("nickname")}
          type="text"
          label="닉네임"
          placeholder="여행자 이름"
          hint="공개 프로필에 표시되며 1~20자로 입력해 주세요."
          autoComplete="nickname"
          minLength={1}
          maxLength={20}
          required
        />
      )}

      <TextField
        {...fieldProps("email")}
        type="email"
        label="이메일"
        placeholder="name@example.com"
        autoCapitalize="none"
        autoComplete={mode === "login" ? "username" : "email"}
        autoCorrect="off"
        inputMode="email"
        spellCheck={false}
        required
      />

      <TextField
        {...fieldProps("password")}
        type="password"
        label="비밀번호"
        placeholder="비밀번호를 입력하세요"
        hint={mode === "signup" ? "8~20자로 입력해 주세요." : undefined}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        minLength={mode === "signup" ? 8 : undefined}
        maxLength={mode === "signup" ? 20 : undefined}
        required
      />

      {mode === "signup" && (
        <TextField
          {...fieldProps("confirmPassword")}
          type="password"
          label="비밀번호 확인"
          placeholder="비밀번호를 다시 입력하세요"
          autoComplete="new-password"
          required
        />
      )}
    </>
  );
}
