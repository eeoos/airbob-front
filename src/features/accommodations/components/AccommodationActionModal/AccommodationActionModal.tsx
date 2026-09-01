import { useEffect, useRef, useState } from "react";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import {
  Button,
  Dialog,
  ImageWithFallback,
  ToastHost,
} from "../../../../shared/ui";
import styles from "./AccommodationActionModal.module.css";

interface AccommodationActionViewModel {
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

type PendingAction = "delete" | "publish" | "unpublish";

function AccommodationImageFallback({ name }: { readonly name: string }) {
  return (
    <div
      aria-label={`${name} 숙소 이미지 없음`}
      className={styles.placeholder}
      role="img"
    >
      <svg aria-hidden="true" viewBox="0 0 32 32">
        <path d="M5 26V13.5L16 5l11 8.5V26a1 1 0 0 1-1 1h-7v-8h-6v8H6a1 1 0 0 1-1-1Z" />
      </svg>
      <span>사진 준비 중</span>
    </div>
  );
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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  useEffect(() => {
    setPendingAction(null);
  }, [accommodation?.id]);

  if (!accommodation) return null;

  const openAndClose = (open: (accommodationId: number) => void) => {
    open(accommodation.id);
    onClose();
  };

  const runAction = (
    action: PendingAction,
    execute: (accommodationId: number) => void,
  ) => {
    setPendingAction(action);
    execute(accommodation.id);
  };

  const accommodationPreview = (
    <>
      <div className={styles.imageContainer}>
        <ImageWithFallback
          src={accommodation.thumbnailUrl}
          alt={accommodation.imageAlt}
          className={styles.image}
          fallback={<AccommodationImageFallback name={accommodation.name} />}
        />
      </div>
      <div className={styles.previewCopy}>
        <span className={styles.name}>{accommodation.name}</span>
        <span className={styles.previewHint}>
          {accommodation.canOpenDetail
            ? "숙소 상세 보기"
            : "공개 후 상세 화면을 확인할 수 있어요"}
        </span>
      </div>
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

      <header className={styles.header}>
        <p className={styles.eyebrow}>호스트 작업공간</p>
        <h2 className={styles.title}>숙소 관리</h2>
        <p className={styles.description}>
          숙소 상태를 확인하고 다음 관리 작업을 선택하세요.
        </p>
      </header>

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
        <div className={styles.accommodationPreview}>
          {accommodationPreview}
        </div>
      )}

      <div
        aria-label="숙소 관리 작업"
        aria-busy={isPending ? true : undefined}
        className={styles.actions}
        role="group"
      >
        {isPending && (
          <span className={styles.srOnly} role="status">
            {pendingAction === "publish"
              ? "리스팅을 공개하고 있습니다."
              : pendingAction === "unpublish"
                ? "리스팅을 비공개로 전환하고 있습니다."
                : pendingAction === "delete"
                  ? "리스팅을 삭제하고 있습니다."
                  : "숙소 관리 작업을 처리하고 있습니다."}
          </span>
        )}
        <Button
          fullWidth
          disabled={isPending}
          onClick={() => openAndClose(onEdit)}
        >
          리스팅 수정
        </Button>

        {accommodation.canUnpublish && (
          <Button
            fullWidth
            disabled={isPending}
            isLoading={isPending && pendingAction === "unpublish"}
            loadingLabel="비공개로 전환 중..."
            onClick={() => runAction("unpublish", onUnpublish)}
            variant="secondary"
          >
            리스팅 비공개
          </Button>
        )}

        {accommodation.canPublish && (
          <Button
            fullWidth
            disabled={isPending}
            isLoading={isPending && pendingAction === "publish"}
            loadingLabel="공개하는 중..."
            onClick={() => runAction("publish", onPublish)}
            variant="secondary"
          >
            리스팅 공개
          </Button>
        )}

        <Button
          variant="ghost"
          className={styles.deleteButton}
          disabled={isPending}
          isLoading={isPending && pendingAction === "delete"}
          loadingLabel="삭제하는 중..."
          onClick={() => runAction("delete", onDelete)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
          리스팅 삭제
        </Button>
      </div>

      {errorMessage && (
        <ToastHost
          closeLabel="오류 닫기"
          message={errorMessage}
          onClose={onDismissError}
        />
      )}
    </Dialog>
  );
}
