import type { FormEvent } from "react";
import type { AuthFormController } from "../../features/auth/model/authForm";
import type { AuthMode } from "../../features/auth/model/auth";
import { AuthFormFields } from "../../features/auth/ui/AuthFormFields";
import { Button, Card, PageContainer, ToastHost } from "../../shared/ui";
import styles from "./AuthScreen.module.css";

export interface AuthScreenProps {
  readonly form: AuthFormController;
  readonly mode: AuthMode;
  onAlternate(): void;
  onSubmit(): void;
}

export function AuthScreen({
  form,
  mode,
  onAlternate,
  onSubmit,
}: AuthScreenProps) {
  const isLogin = mode === "login";
  const title = isLogin ? "로그인" : "회원가입";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className={styles.container}>
      <PageContainer className={styles.page} variant="narrow">
        <Card className={styles.card} padding="lg">
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <AuthFormFields
              idPrefix="auth-screen"
              mode={mode}
              values={form.values}
              onFieldChange={form.setField}
            />

            <Button
              type="submit"
              fullWidth
              isLoading={form.isLoading}
              loadingLabel={isLogin ? "로그인 중..." : "가입 중..."}
              className={styles.submitButton}
            >
              {title}
            </Button>
          </form>

          <div className={styles.footer}>
            <span className={styles.footerText}>
              {isLogin ? "계정이 없으신가요? " : "이미 계정이 있으신가요? "}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={styles.linkButton}
              onClick={onAlternate}
            >
              {isLogin ? "회원가입" : "로그인"}
            </Button>
          </div>
        </Card>
      </PageContainer>

      {form.error && (
        <ToastHost
          closeLabel="오류 닫기"
          message={form.error}
          onClose={form.clearError}
        />
      )}
    </div>
  );
}
