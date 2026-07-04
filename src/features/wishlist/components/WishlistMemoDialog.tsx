import { Dialog } from "../../../shared/ui";
import styles from "./WishlistViews.module.css";

interface WishlistMemoDialogProps {
  isOpen: boolean;
  memoText: string;
  onChangeMemoText: (value: string) => void;
  onClear: () => void;
  onClose: () => void;
  onSave: () => void;
}

export function WishlistMemoDialog({
  isOpen,
  memoText,
  onChangeMemoText,
  onClear,
  onClose,
  onSave,
}: WishlistMemoDialogProps) {
  return (
    <Dialog
      bodyPadding="none"
      className={styles.memoModal}
      closeButtonLabel="✕"
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="메모 추가"
    >
      <div className={styles.memoModalBody}>
        <textarea
          className={styles.memoTextarea}
          value={memoText}
          onChange={(event) => onChangeMemoText(event.target.value)}
          placeholder="메모를 입력하세요"
          maxLength={250}
          aria-label="메모"
        />
        <div className={styles.memoCharCount}>{memoText.length}/250자</div>
      </div>
      <div className={styles.memoModalFooter}>
        <button
          className={styles.memoClearButton}
          onClick={onClear}
          type="button"
        >
          모두 지우기
        </button>
        <button
          className={styles.memoSaveButton}
          onClick={onSave}
          disabled={!memoText.trim()}
          type="button"
        >
          저장
        </button>
      </div>
    </Dialog>
  );
}
