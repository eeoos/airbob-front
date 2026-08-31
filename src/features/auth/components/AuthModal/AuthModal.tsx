import React, { useCallback, useState, useEffect, useRef } from "react";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import { Button, Dialog, ToastHost } from "../../../../shared/ui";
import { useAuthForm } from "../../model/authForm";
import { useAuthCommands } from "../../ports/AuthCommandProvider";
import { AuthFormFields } from "../../ui/AuthFormFields";
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
  const commands = useAuthCommands();
  const form = useAuthForm(
    mode === "login"
      ? { mode: "login", login: commands.login }
      : { mode: "signup", signup: commands.signup },
  );
  const isMountedRef = useRef(true);
  const viewGenerationRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    viewGenerationRef.current += 1;

    if (isOpen) {
      setMode(initialMode);
      form.reset();
    }
    // `form.reset` is stable and the form is intentionally reset only when
    // the modal opens or its requested initial mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode]);

  const closeCurrentView = useCallback(() => {
    viewGenerationRef.current += 1;
    onClose();
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submittedMode = mode;
    const submittedGeneration = viewGenerationRef.current;
    const succeeded = await form.submit();

    if (
      !succeeded ||
      !isMountedRef.current ||
      submittedGeneration !== viewGenerationRef.current
    ) {
      return;
    }

    if (submittedMode === "login") {
      if (!commands.shouldCompleteLoginInCurrentView()) {
        return;
      }

      closeCurrentView();
      onSuccess?.();
      return;
    }

    setMode("login");
    viewGenerationRef.current += 1;
    form.reset();
  };

  const handleSwitchMode = () => {
    if (form.isLoading) return;

    setMode(mode === "login" ? "signup" : "login");
    viewGenerationRef.current += 1;
    form.reset();
  };

  const title = mode === "login" ? "로그인" : "회원가입";

  return (
    <Dialog
      isOpen={isOpen}
      title={title}
      onClose={closeCurrentView}
      className={requireCssModuleClass(styles.dialog)}
      bodyClassName={requireCssModuleClass(styles.content)}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <AuthFormFields
          idPrefix="auth-modal"
          inputClassName={requireCssModuleClass(styles.input)}
          mode={mode}
          values={form.values}
          onFieldChange={form.setField}
        />

        <Button
          type="submit"
          className={styles.submitButton}
          isLoading={form.isLoading}
          loadingLabel={mode === "login" ? "로그인 중..." : "가입 중..."}
        >
          {mode === "login" ? "로그인" : "회원가입"}
        </Button>
      </form>

      <div className={styles.footer}>
        <span className={styles.footerText}>
          {mode === "login"
            ? "계정이 없으신가요? "
            : "이미 계정이 있으신가요? "}
        </span>
        <button
          type="button"
          className={styles.linkButton}
          disabled={form.isLoading}
          onClick={handleSwitchMode}
        >
          {mode === "login" ? "회원가입" : "로그인"}
        </button>
      </div>
      {form.error && (
        <ToastHost
          closeLabel="오류 닫기"
          message={form.error}
          onClose={form.clearError}
        />
      )}
    </Dialog>
  );
};
