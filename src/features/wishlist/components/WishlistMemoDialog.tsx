import { requireCssModuleClass } from "../../../shared/styles/requireCssModuleClass";
import { Button, Dialog } from "../../../shared/ui";
import styles from "./WishlistViews.module.css";

interface WishlistMemoDialogProps {
  errorMessage?: string | null;
  isPending?: boolean;
  isOpen: boolean;
  memoText: string;
  onChangeMemoText: (value: string) => void;
  onClear: () => void;
  onClose: () => void;
  onDismissError?: () => void;
  onSave: () => void;
}

export function WishlistMemoDialog({
  errorMessage,
  isPending = false,
  isOpen,
  memoText,
  onChangeMemoText,
  onClear,
  onClose,
  onDismissError,
  onSave,
}: WishlistMemoDialogProps) {
  const descriptionId = "wishlist-memo-description";
  const errorId = "wishlist-memo-error";

  return (
    <Dialog
      bodyPadding="none"
      className={requireCssModuleClass(styles.memoModal)}
      closeButtonLabel="메모 닫기"
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="숙소 메모"
    >
      <div className={styles.memoModalBody} aria-busy={isPending || undefined}>
        <p className={styles.memoDescription} id={descriptionId}>
          여행 계획에 필요한 내용을 250자까지 남길 수 있어요.
        </p>
        <textarea
          aria-describedby={`${descriptionId}${
            errorMessage ? ` ${errorId}` : ""
          }`}
          aria-invalid={errorMessage ? true : undefined}
          className={styles.memoTextarea}
          value={memoText}
          onChange={(event) => onChangeMemoText(event.target.value)}
          placeholder="예: 바다 전망 객실 문의하기"
          maxLength={250}
          aria-label="메모"
        />
        <div aria-live="polite" className={styles.memoCharCount}>
          {memoText.length}/250자
        </div>
        {errorMessage && (
          <div className={styles.dialogError} id={errorId} role="alert">
            <div>
              <strong>메모를 저장하지 못했어요</strong>
              <span>{errorMessage}</span>
            </div>
            {onDismissError && (
              <button type="button" onClick={onDismissError}>
                알림 닫기
              </button>
            )}
          </div>
        )}
      </div>
      <div className={styles.memoModalFooter}>
        <Button
          className={styles.memoClearButton}
          onClick={onClear}
          disabled={isPending || memoText.length === 0}
          size="sm"
          variant="ghost"
        >
          모두 지우기
        </Button>
        <Button
          className={styles.memoSaveButton}
          isLoading={isPending}
          loadingLabel="저장 중..."
          onClick={onSave}
          size="sm"
        >
          {errorMessage ? "다시 저장" : "저장"}
        </Button>
      </div>
    </Dialog>
  );
}
