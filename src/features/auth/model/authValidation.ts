import type { SignupFormData } from "./auth";

export const validateSignupForm = (
  formData: SignupFormData,
): string | null => {
  if (formData.password !== formData.confirmPassword) {
    return "비밀번호가 일치하지 않습니다.";
  }

  if (formData.password.length < 8 || formData.password.length > 20) {
    return "비밀번호는 8자 이상 20자 이하여야 합니다.";
  }

  return null;
};
