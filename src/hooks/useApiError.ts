import { useState, useCallback } from "react";
import { getApiErrorMessage, isAuthError } from "../utils/error";

/**
 * API 에러 처리를 위한 훅
 */
export const useApiError = () => {
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((error: unknown) => {
    const message = getApiErrorMessage(error);
    setError(message);
    
    // 인증 에러인 경우 추가 처리
    if (isAuthError(error)) {
      // 필요시 로그인 페이지로 리다이렉트
      // window.location.href = "/login";
    }

    return message;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    handleError,
    clearError,
  };
};







