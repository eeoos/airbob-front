import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AuthFormField,
  AuthFormValues,
  LoginCredentials,
  SignupCommand,
} from "./auth";
import { createEmptyAuthForm } from "./auth";
import { toAuthErrorMessage } from "./authError";
import { validateSignupForm } from "./authValidation";

type LoginFormOptions = {
  readonly mode: "login";
  readonly login: (credentials: LoginCredentials) => Promise<void>;
};

type SignupFormOptions = {
  readonly mode: "signup";
  readonly signup: (command: SignupCommand) => Promise<void>;
};

export type AuthFormOptions = LoginFormOptions | SignupFormOptions;

export interface AuthFormController {
  readonly values: AuthFormValues;
  readonly error: string | null;
  readonly isLoading: boolean;
  clearError(): void;
  reset(): void;
  setField(field: AuthFormField, value: string): void;
  submit(): Promise<boolean>;
}

export const useAuthForm = (options: AuthFormOptions): AuthFormController => {
  const [values, setValues] = useState<AuthFormValues>(createEmptyAuthForm);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);
  const pendingRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    setValues(createEmptyAuthForm());
    setError(null);
  }, []);

  const setField = useCallback((field: AuthFormField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  }, []);

  const submit = useCallback((): Promise<boolean> => {
    if (pendingRef.current) {
      return pendingRef.current;
    }

    const formSnapshot = values;
    setError(null);

    if (options.mode === "signup") {
      const validationError = validateSignupForm(formSnapshot);
      if (validationError) {
        setError(validationError);
        return Promise.resolve(false);
      }
    }

    setIsLoading(true);

    let commandPromise: Promise<void>;

    try {
      commandPromise =
        options.mode === "login"
          ? options.login({
              email: formSnapshot.email,
              password: formSnapshot.password,
            })
          : options.signup({
              nickname: formSnapshot.nickname,
              email: formSnapshot.email,
              password: formSnapshot.password,
            });
    } catch (submissionError) {
      commandPromise = Promise.reject(submissionError);
    }

    const operation = Promise.resolve(commandPromise).then(
      () => true,
      (submissionError) => {
        if (mountedRef.current) {
          setError(toAuthErrorMessage(submissionError));
        }
        return false;
      },
    );
    const pending = operation.finally(() => {
      if (pendingRef.current === pending) {
        pendingRef.current = null;
      }

      if (mountedRef.current) {
        setIsLoading(false);
      }
    });

    pendingRef.current = pending;
    return pending;
  }, [options, values]);

  return {
    values,
    error,
    isLoading,
    clearError,
    reset,
    setField,
    submit,
  };
};
