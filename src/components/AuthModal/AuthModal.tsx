import React, { useCallback, useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useApiError } from "../../hooks/useApiError";
import { useSignup } from "../../features/auth/hooks/useSignup";
import { Dialog } from "../../shared/ui";
import { ErrorToast } from "../ErrorToast";
import styles from "./AuthModal.module.css";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "signup";
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = "login",
  onSuccess,
}) => {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const { login } = useAuth();
  const { error: loginError, handleError, clearError } = useApiError();
  const {
    error: signupError,
    clearError: clearSignupError,
    isLoading: isSignupLoading,
    signup,
  } = useSignup();
  const [formData, setFormData] = useState({
    nickname: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const error = loginError || signupError;
  const isLoading = mode === "login" ? isLoginLoading : isSignupLoading;
  const clearAuthErrors = useCallback(() => {
    clearError();
    clearSignupError();
  }, [clearError, clearSignupError]);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setFormData({
        nickname: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      clearAuthErrors();
    }
  }, [isOpen, initialMode, clearAuthErrors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthErrors();

    if (mode === "login") {
      setIsLoginLoading(true);

      try {
        await login({
          email: formData.email,
          password: formData.password,
        });
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoginLoading(false);
      }
      return;
    }

    const signedUp = await signup(formData);
    if (signedUp) {
      // 회원가입 성공 후 로그인 모드로 전환
      setMode("login");
      setFormData({
        nickname: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSwitchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    clearAuthErrors();
    setFormData({
      nickname: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  };

  const title = mode === "login" ? "로그인" : "회원가입";

  return (
    <Dialog
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      className={styles.dialog}
      bodyClassName={styles.content}
    >
          <form onSubmit={handleSubmit} className={styles.form}>
            {mode === "signup" && (
              <div className={styles.inputGroup}>
                <label htmlFor="nickname" className={styles.label}>
                  닉네임
                </label>
                <input
                  type="text"
                  id="nickname"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="닉네임을 입력하세요 (1-20자)"
                  minLength={1}
                  maxLength={20}
                  required
                />
              </div>
            )}

            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>
                이메일
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={styles.input}
                placeholder="이메일을 입력하세요"
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                비밀번호
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={styles.input}
                placeholder={
                  mode === "login"
                    ? "비밀번호를 입력하세요"
                    : "비밀번호를 입력하세요 (8-20자)"
                }
                minLength={mode === "signup" ? 8 : undefined}
                maxLength={mode === "signup" ? 20 : undefined}
                required
              />
            </div>

            {mode === "signup" && (
              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword" className={styles.label}>
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading
                ? mode === "login"
                  ? "로그인 중..."
                  : "가입 중..."
                : mode === "login"
                ? "로그인"
                : "회원가입"}
            </button>
          </form>

          <div className={styles.footer}>
            <span className={styles.footerText}>
              {mode === "login" ? "계정이 없으신가요? " : "이미 계정이 있으신가요? "}
            </span>
            <button
              type="button"
              className={styles.linkButton}
              onClick={handleSwitchMode}
            >
              {mode === "login" ? "회원가입" : "로그인"}
            </button>
          </div>
      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearAuthErrors} />
        </div>
      )}
    </Dialog>
  );
};
