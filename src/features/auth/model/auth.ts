export type AuthMode = "login" | "signup";

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

export interface SignupCommand {
  readonly nickname: string;
  readonly email: string;
  readonly password: string;
}

export interface SignupFormData extends SignupCommand {
  readonly confirmPassword: string;
}

export type AuthFormValues = SignupFormData;

export type AuthFormField = keyof AuthFormValues;

export interface AuthViewer {
  readonly id: number;
  readonly email: string;
  readonly nickname: string;
  readonly thumbnailImageUrl: string | null;
}

export const createEmptyAuthForm = (): AuthFormValues => ({
  nickname: "",
  email: "",
  password: "",
  confirmPassword: "",
});
