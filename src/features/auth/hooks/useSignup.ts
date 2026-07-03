import { useCallback, useState } from "react";
import { authApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";

export interface SignupFormData {
  nickname: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function useSignup() {
  const { error, handleError, clearError } = useApiError();
  const [isLoading, setIsLoading] = useState(false);

  const signup = useCallback(
    async (formData: SignupFormData) => {
      clearError();

      if (formData.password !== formData.confirmPassword) {
        handleError(new Error("비밀번호가 일치하지 않습니다."));
        return false;
      }

      if (formData.password.length < 8 || formData.password.length > 20) {
        handleError(new Error("비밀번호는 8자 이상 20자 이하여야 합니다."));
        return false;
      }

      setIsLoading(true);

      try {
        await authApi.signup({
          nickname: formData.nickname,
          email: formData.email,
          password: formData.password,
        });
        return true;
      } catch (error) {
        handleError(error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [clearError, handleError]
  );

  return {
    clearError,
    error,
    isLoading,
    signup,
  };
}
