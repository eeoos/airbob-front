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
// missing chunk (stale tab after a deploy, or a dropped connection).
const CHUNK_LOAD_ERROR_PATTERN =
  /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

const isChunkLoadError = (error: Error | null): boolean =>
  error !== null && CHUNK_LOAD_ERROR_PATTERN.test(error.message);

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

    if (isChunkLoadError(this.state.error)) {
      return (
        <div className={styles.container}>
          <div className={styles.content}>
            <h2 className={styles.title}>페이지를 불러오지 못했습니다</h2>
            <p className={styles.message}>
              새 버전이 배포되었거나 네트워크 연결이 불안정할 수 있습니다.
              새로고침해 주세요.
            </p>
            <Button
              className={styles.button}
              onClick={browserWindowNavigation.reloadPage}
            >
              새로고침
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <h2 className={styles.title}>오류가 발생했습니다</h2>
          <p className={styles.message}>
            {this.state.error?.message || "예상치 못한 오류가 발생했습니다."}
          </p>
          <Button className={styles.button} onClick={this.reset}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }
}
