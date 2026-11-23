import { Component, type ErrorInfo, type ReactNode } from "react";
import { browserWindowNavigation } from "../../platform/browser/windowNavigation";
import { clientLogger } from "../../platform/logging/clientLogger";
import { Button } from "../../shared/ui";
import styles from "./ErrorBoundary.module.css";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

// A lazy route keeps its failed import, so re-rendering cannot recover from a
// missing chunk (stale tab after a deploy, or a dropped connection). Retry
// reloads the page for these. The copy is shared with other errors because
// the initial JavaScript budget has no room for a dedicated message.
const CHUNK_LOAD_ERROR = /imported module|module script failed|preload CSS/i;

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    clientLogger.error({
      message: "ErrorBoundary caught an error:",
      error: { error, errorInfo },
    });
  }

  private readonly reset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const message = this.state.error?.message;
    const isChunkLoadError = CHUNK_LOAD_ERROR.test(message ?? "");

    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <h2 className={styles.title}>오류가 발생했습니다</h2>
          <p className={styles.message}>
            {(!isChunkLoadError && message) ||
              "예상치 못한 오류가 발생했습니다."}
          </p>
          <Button
            className={styles.button}
            onClick={
              isChunkLoadError ? browserWindowNavigation.reloadPage : this.reset
            }
          >
            다시 시도
          </Button>
        </div>
      </div>
    );
  }
}
