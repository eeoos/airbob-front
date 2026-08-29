import { Button } from "../../shared/ui";
import styles from "./SessionProvider.module.css";

interface LogoutRevocationNoticeProps {
  readonly onRetry: () => void;
  readonly visible: boolean;
}

export function LogoutRevocationNotice({
  onRetry,
  visible,
}: LogoutRevocationNoticeProps) {
  if (!visible) return null;

  return (
    <div className={styles.notice} role="alert" aria-live="assertive">
      <span>서버에서 로그아웃을 확인하지 못했습니다.</span>
      <Button
        size="sm"
        type="button"
        variant="secondary"
        onClick={onRetry}
      >
        다시 시도
      </Button>
    </div>
  );
}
