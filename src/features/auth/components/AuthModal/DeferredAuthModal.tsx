import {
  Component,
  Suspense,
  lazy,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { clientLogger } from "../../../../platform/logging/clientLogger";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import { Button, Dialog, RetryableErrorState } from "../../../../shared/ui";
import type { AuthModalProps } from "./AuthModal";
import styles from "./DeferredAuthModal.module.css";

type AuthModalModule = {
  readonly default: ComponentType<AuthModalProps>;
};

type AuthModalLoader = () => Promise<AuthModalModule>;

interface DeferredAuthModalProps extends AuthModalProps {
  readonly loadAuthModal?: AuthModalLoader;
}

interface AuthModalLoadBoundaryProps {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
}

interface AuthModalLoadBoundaryState {
  readonly hasError: boolean;
}

interface DeferredAuthModalState {
  readonly LoadableAuthModal: ComponentType<AuthModalProps>;
  readonly loadAttempt: number;
}

class AuthModalLoadBoundary extends Component<
  AuthModalLoadBoundaryProps,
  AuthModalLoadBoundaryState
> {
  override state: AuthModalLoadBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AuthModalLoadBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    clientLogger.error({
      message: "Deferred auth modal failed to load.",
      error: { name: error.name, componentStack: errorInfo.componentStack },
    });
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const loadDefaultAuthModal: AuthModalLoader = async () => {
  const { AuthModal } = await import("./AuthModal");

  return { default: AuthModal };
};

export class DeferredAuthModal extends Component<
  DeferredAuthModalProps,
  DeferredAuthModalState
> {
  override state: DeferredAuthModalState = {
    LoadableAuthModal: lazy(this.props.loadAuthModal ?? loadDefaultAuthModal),
    loadAttempt: 0,
  };

  private readonly retryLoad = () => {
    this.setState((state) => ({
      LoadableAuthModal: lazy(this.props.loadAuthModal ?? loadDefaultAuthModal),
      loadAttempt: state.loadAttempt + 1,
    }));
  };

  override render() {
    const { initialMode = "login", isOpen, onClose, onSuccess } = this.props;
    const { LoadableAuthModal, loadAttempt } = this.state;
    const title = initialMode === "signup" ? "회원가입" : "로그인";

    if (!isOpen) return null;

    return (
      <AuthModalLoadBoundary
        key={loadAttempt}
        fallback={
          <Dialog
            bodyPadding="none"
            className={requireCssModuleClass(styles.dialog)}
            isOpen
            onClose={onClose}
            size="sm"
            title={title}
          >
            <RetryableErrorState
              className={styles.errorState}
              title="계정 화면을 불러오지 못했어요"
              description="네트워크 연결을 확인한 뒤 다시 시도해주세요."
              action={
                <div className={styles.errorActions}>
                  <Button onClick={this.retryLoad}>다시 시도</Button>
                  <Button onClick={onClose} variant="secondary">
                    닫기
                  </Button>
                </div>
              }
            />
          </Dialog>
        }
      >
        <Suspense
          fallback={
            <Dialog
              bodyPadding="none"
              className={requireCssModuleClass(styles.dialog)}
              isOpen
              onClose={onClose}
              size="sm"
              title={title}
            >
              <div className={styles.loadingState} role="status">
                계정 화면을 불러오는 중입니다.
              </div>
            </Dialog>
          }
        >
          <LoadableAuthModal
            initialMode={initialMode}
            isOpen
            onClose={onClose}
            {...(onSuccess ? { onSuccess } : {})}
          />
        </Suspense>
      </AuthModalLoadBoundary>
    );
  }
}
