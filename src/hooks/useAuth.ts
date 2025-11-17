import { useAuth as useAuthContext } from "../contexts/AuthContext";

/**
 * 인증 관련 훅
 * AuthContext를 간편하게 사용하기 위한 래퍼
 */
export const useAuth = () => {
  return useAuthContext();
};





