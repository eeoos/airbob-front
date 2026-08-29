import { useEffect, useRef } from "react";
import type {
  LoginCredentials,
  SignupCommand,
} from "../../features/auth/model/auth";
import {
  useAuthForm,
  type AuthFormOptions,
} from "../../features/auth/model/authForm";
import { AuthScreen } from "./AuthScreen";

interface AuthControllerBaseProps {
  readonly canComplete: () => boolean;
  readonly onAlternate: () => void;
  readonly onSuccess: () => void;
}

export interface LoginAuthControllerProps extends AuthControllerBaseProps {
  readonly mode: "login";
  readonly submitLogin: (credentials: LoginCredentials) => Promise<void>;
}

export interface SignupAuthControllerProps extends AuthControllerBaseProps {
  readonly mode: "signup";
  readonly submitSignup: (command: SignupCommand) => Promise<void>;
}

export type AuthControllerProps =
  | LoginAuthControllerProps
  | SignupAuthControllerProps;

type CompletionState = "active" | "completed" | "invalidated";

export function AuthController(props: AuthControllerProps) {
  const formOptions: AuthFormOptions =
    props.mode === "login"
      ? { mode: "login", login: props.submitLogin }
      : { mode: "signup", signup: props.submitSignup };
  const form = useAuthForm(formOptions);
  const handledSubmissionRef = useRef<Promise<boolean> | null>(null);
  const completionStateRef = useRef<CompletionState>("active");

  useEffect(
    () => () => {
      completionStateRef.current = "invalidated";
    },
    [],
  );

  const handleSubmit = () => {
    if (completionStateRef.current !== "active") return;

    const submission = form.submit();
    if (handledSubmissionRef.current === submission) return;
    handledSubmissionRef.current = submission;

    void submission.then((succeeded) => {
      if (
        !succeeded ||
        completionStateRef.current !== "active" ||
        !props.canComplete()
      ) {
        return;
      }

      completionStateRef.current = "completed";
      props.onSuccess();
    });
  };

  const handleAlternate = () => {
    completionStateRef.current = "invalidated";
    props.onAlternate();
  };

  return (
    <AuthScreen
      form={form}
      mode={props.mode}
      onAlternate={handleAlternate}
      onSubmit={handleSubmit}
    />
  );
}
