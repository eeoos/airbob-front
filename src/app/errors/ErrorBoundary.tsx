import { Component, type ErrorInfo, type ReactNode } from "react";
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

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    clientLogger.error({
      message: "ErrorBoundary caught an error:",
      error: { error, errorInfo },
    });
  }

  private readonly reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

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
