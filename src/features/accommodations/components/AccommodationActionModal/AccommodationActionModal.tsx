import { useRef } from "react";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import { Button, Dialog, ToastHost } from "../../../../shared/ui";
import styles from "./AccommodationActionModal.module.css";

export interface AccommodationActionViewModel {
  readonly canOpenDetail: boolean;
  readonly canPublish: boolean;
  readonly canUnpublish: boolean;
  readonly id: number;
  readonly imageAlt: string;
  readonly name: string;
  readonly thumbnailUrl: string | null;
}

export interface AccommodationActionModalProps {
  readonly accommodation: AccommodationActionViewModel | null;
  readonly errorMessage: string | null;
  readonly isPending: boolean;
  readonly onClose: () => void;
  readonly onDelete: (accommodationId: number) => void;
  readonly onDismissError: () => void;
  readonly onEdit: (accommodationId: number) => void;
  readonly onOpenDetail: (accommodationId: number) => void;
  readonly onPublish: (accommodationId: number) => void;
  readonly onUnpublish: (accommodationId: number) => void;
}

export function AccommodationActionModal({
  accommodation,
  errorMessage,
  isPending,
  onClose,
  onDelete,
  onDismissError,
  onEdit,
  onOpenDetail,
  onPublish,
  onUnpublish,
}: AccommodationActionModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  if (!accommodation) return null;

  const openAndClose = (open: (accommodationId: number) => void) => {
    open(accommodation.id);
    onClose();
  };

  const accommodationPreview = (
    <>
      <div className={styles.imageContainer}>
        {accommodation.thumbnailUrl ? (
          <img
            src={accommodation.thumbnailUrl}
            alt={accommodation.imageAlt}
            className={styles.image}
          />
        ) : (
          <div className={styles.placeholder} />
        )}
      </div>
      <div className={styles.name}>{accommodation.name}</div>
    </>
  );

  return (
    <Dialog
      bodyClassName={requireCssModuleClass(styles.content)}
      bodyPadding="none"
      className={requireCssModuleClass(styles.dialog)}
      initialFocusRef={closeButtonRef}
      isOpen
      onClose={onClose}
      showHeader={false}
      size="sm"
      title="숙소 관리"
    >
      <button
        ref={closeButtonRef}
        aria-label="숙소 관리 닫기"
        className={styles.closeButton}
        type="button"
        onClick={onClose}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>

      {accommodation.canOpenDetail ? (
        <button
          aria-label={`${accommodation.name} 상세 보기`}
          className={styles.accommodationHeader}
          type="button"
          onClick={() => openAndClose(onOpenDetail)}
        >
          {accommodationPreview}
        </button>
      ) : (
        accommodationPreview
      )}

      <div className={styles.actions}>
        <Button
          className={styles.editButton}
          disabled={isPending}
          onClick={() => openAndClose(onEdit)}
        >
          리스팅 수정
        </Button>

        {accommodation.canUnpublish && (
          <Button
            className={styles.actionButton}
            disabled={isPending}
            onClick={() => onUnpublish(accommodation.id)}
          >
            리스팅 비공개
          </Button>
        )}

        {accommodation.canPublish && (
          <Button
            className={styles.actionButton}
            disabled={isPending}
            onClick={() => onPublish(accommodation.id)}
          >
            리스팅 공개
          </Button>
        )}

        <Button
          variant="ghost"
          className={styles.deleteButton}
          disabled={isPending}
          onClick={() => onDelete(accommodation.id)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
          리스팅 삭제
        </Button>
      </div>

      {errorMessage && (
        <div className={styles.toastContainer}>
          <ToastHost
            closeLabel="오류 닫기"
            message={errorMessage}
            onClose={onDismissError}
          />
        </div>
      )}
    </Dialog>
  );
}
