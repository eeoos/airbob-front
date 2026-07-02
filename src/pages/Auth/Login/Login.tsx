import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useApiError } from "../../../hooks/useApiError";
import { ErrorToast } from "../../../components/ErrorToast";
import { routeTo } from "../../../routes/paths";
import { Button, Card, TextField } from "../../../shared/ui";
import styles from "./Login.module.css";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { error, handleError, clearError } = useApiError();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);

    try {
      await login({
        email: formData.email,
        password: formData.password,
      });
      navigate(routeTo.home());
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
          <h2 className={styles.title}>로그인</h2>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
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
            placeholder="비밀번호를 입력하세요"
            required
          />

          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            loadingLabel="로그인 중..."
            className={styles.submitButton}
          >
            로그인
          </Button>
        </form>

        <div className={styles.footer}>
          <span className={styles.footerText}>계정이 없으신가요? </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.linkButton}
            onClick={() => navigate(routeTo.signup())}
          >
            회원가입
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

export default Login;
