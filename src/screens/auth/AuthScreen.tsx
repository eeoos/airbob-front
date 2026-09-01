import type { FormEvent } from "react";
import type { AuthFormController } from "../../features/auth/model/authForm";
import type { AuthMode } from "../../features/auth/model/auth";
import { AuthFormFields } from "../../features/auth/ui/AuthFormFields";
import { requireCssModuleClass } from "../../shared/styles/requireCssModuleClass";
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
  const intro = isLogin
    ? "저장한 숙소와 예약 내역을 이어서 확인하세요."
    : "Airbob 계정으로 머물 곳을 저장하고 여행을 준비하세요.";
  const errorContextId = "auth-screen-error-context";
  const introId = "auth-screen-intro";
  const submitLabel = form.error ? `다시 ${title}` : title;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className={styles.container}>
      <PageContainer variant="narrow">
        <Card as="div" className={styles.card} padding="none">
          <section className={styles.brandPanel} aria-labelledby="auth-title">
            <p className={styles.brandName}>Airbob</p>
            <div className={styles.headingGroup}>
              <p className={styles.eyebrow}>나의 여행 계정</p>
              <h1 id="auth-title" className={styles.title}>
                {title}
              </h1>
              <p id={introId} className={styles.intro}>
                {intro}
              </p>
            </div>
            <p className={styles.journeyNote}>검색 · 저장 · 예약을 한곳에서</p>
          </section>

          <section
            className={styles.formPanel}
            aria-label={`${title} 정보 입력`}
          >
            <form
              onSubmit={handleSubmit}
              className={styles.form}
              aria-label={`${title} 양식`}
              aria-busy={form.isLoading ? true : undefined}
              aria-describedby={
                form.error ? `${introId} ${errorContextId}` : introId
              }
            >
              <AuthFormFields
                idPrefix="auth-screen"
                inputClassName={requireCssModuleClass(styles.input)}
                mode={mode}
                values={form.values}
                onFieldChange={form.setField}
              />

              {form.error && (
                <div
                  id={errorContextId}
                  className={styles.errorContext}
                  data-testid="auth-inline-error"
                >
                  <span className={styles.errorIcon} aria-hidden="true">
                    !
                  </span>
                  <div>
                    <p className={styles.errorTitle}>확인이 필요해요</p>
                    <p className={styles.errorMessage}>{form.error}</p>
                    <p className={styles.errorHint}>
                      입력 내용을 확인하고 다시 시도해 주세요.
                    </p>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={form.isLoading}
                loadingLabel={isLogin ? "로그인하는 중…" : "가입하는 중…"}
                className={styles.submitButton}
              >
                {submitLabel}
              </Button>
            </form>

            <div className={styles.footer}>
              <span className={styles.footerText}>
                {isLogin ? "계정이 없으신가요?" : "이미 계정이 있으신가요?"}
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
          </section>
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
