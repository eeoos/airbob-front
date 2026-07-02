import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { ErrorToast } from "../../../components/ErrorToast";
import { routeTo } from "../../../routes/paths";
import { Button, Card, TextField } from "../../../shared/ui";
import styles from "./Signup.module.css";

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { error, handleError, clearError } = useApiError();
  const [formData, setFormData] = useState({
    nickname: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (formData.password !== formData.confirmPassword) {
      handleError(new Error("비밀번호가 일치하지 않습니다."));
      return;
    }

    if (formData.password.length < 8 || formData.password.length > 20) {
      handleError(new Error("비밀번호는 8자 이상 20자 이하여야 합니다."));
      return;
    }

    setIsLoading(true);

    try {
      await authApi.signup({
        nickname: formData.nickname,
        email: formData.email,
        password: formData.password,
      });
      navigate(routeTo.login());
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

  return (
    <div className={styles.container}>
      <Card className={styles.modal} padding="lg">
        <div className={styles.header}>
          <h2 className={styles.title}>회원가입</h2>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <TextField
            type="text"
            id="nickname"
            name="nickname"
            label="닉네임"
            value={formData.nickname}
            onChange={handleChange}
            placeholder="닉네임을 입력하세요 (1-20자)"
            minLength={1}
            maxLength={20}
            required
          />

          <TextField
            type="email"
            id="email"
            name="email"
            label="이메일"
            value={formData.email}
            onChange={handleChange}
            placeholder="이메일을 입력하세요"
            required
          />

          <TextField
            type="password"
            id="password"
            name="password"
            label="비밀번호"
            value={formData.password}
            onChange={handleChange}
            placeholder="비밀번호를 입력하세요 (8-20자)"
            minLength={8}
            maxLength={20}
            required
          />

          <TextField
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            label="비밀번호 확인"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="비밀번호를 다시 입력하세요"
            required
          />

          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            loadingLabel="가입 중..."
            className={styles.submitButton}
          >
            회원가입
          </Button>
        </form>

        <div className={styles.footer}>
          <span className={styles.footerText}>이미 계정이 있으신가요? </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.linkButton}
            onClick={() => navigate(routeTo.login())}
          >
            로그인
          </Button>
        </div>
      </Card>

      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}
    </div>
  );
};

export default Signup;
