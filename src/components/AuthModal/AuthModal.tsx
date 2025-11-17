import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { authApi } from "../../api";
import { useApiError } from "../../hooks/useApiError";
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
  const { error, handleError, clearError } = useApiError();
  const [formData, setFormData] = useState({
    nickname: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setFormData({
        nickname: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      clearError();
    }
  }, [isOpen, initialMode, clearError]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);

    try {
      if (mode === "login") {
        await login({
          email: formData.email,
          password: formData.password,
        });
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        if (formData.password !== formData.confirmPassword) {
          handleError(new Error("비밀번호가 일치하지 않습니다."));
          return;
        }

        if (formData.password.length < 8 || formData.password.length > 20) {
          handleError(new Error("비밀번호는 8자 이상 20자 이하여야 합니다."));
          return;
        }

        await authApi.signup({
          nickname: formData.nickname,
          email: formData.email,
          password: formData.password,
        });
        // 회원가입 성공 후 로그인 모드로 전환
        setMode("login");
        setFormData({
          nickname: "",
          email: "",
          password: "",
          confirmPassword: "",
        });
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
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
    clearError();
    setFormData({
      nickname: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        <div className={styles.content}>
          <h2 className={styles.title}>
            {mode === "login" ? "로그인" : "회원가입"}
          </h2>

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
        </div>

        {error && (
          <div className={styles.toastContainer}>
            <ErrorToast message={error} onClose={clearError} />
          </div>
        )}
      </div>
    </>
  );
};


