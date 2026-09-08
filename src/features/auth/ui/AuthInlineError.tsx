import styles from "./AuthInlineError.module.css";

interface AuthInlineErrorProps {
  readonly id: string;
  readonly message: string;
  readonly testId: string;
}

export function AuthInlineError({ id, message, testId }: AuthInlineErrorProps) {
  return (
    <div className={styles.errorContext} data-testid={testId} id={id}>
      <span aria-hidden="true" className={styles.errorIcon}>
        !
      </span>
      <div>
        <p className={styles.errorTitle}>확인이 필요해요</p>
        <p className={styles.errorMessage}>{message}</p>
        <p className={styles.errorHint}>
          입력 내용을 확인하고 다시 시도해 주세요.
        </p>
      </div>
    </div>
  );
}
