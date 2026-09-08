import { useEffect, useState, type ComponentType } from "react";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import {
  Button,
  Dialog,
  LoadingState,
  RetryableErrorState,
} from "../../../../shared/ui";
import type { WishlistModalProps } from "./WishlistModal";
import styles from "./WishlistModal.module.css";

interface WishlistModalModule {
  readonly WishlistModal: ComponentType<WishlistModalProps>;
}

interface DeferredWishlistModalProps extends WishlistModalProps {
  readonly loadWishlistModal?: () => Promise<WishlistModalModule>;
}

const loadDefaultWishlistModal = () => import("./WishlistModal");

export function DeferredWishlistModal({
  loadWishlistModal = loadDefaultWishlistModal,
  ...props
}: DeferredWishlistModalProps) {
  const [LoadedModal, setLoadedModal] =
    useState<ComponentType<WishlistModalProps> | null>(null);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!props.isOpen || LoadedModal) return;
    let active = true;
    setHasError(false);
    void Promise.resolve()
      .then(loadWishlistModal)
      .then(
        (module) => {
          if (active) setLoadedModal(() => module.WishlistModal);
        },
        () => {
          if (active) setHasError(true);
        },
      );
    return () => {
      active = false;
    };
  }, [props.isOpen, LoadedModal, loadWishlistModal, attempt]);

  if (!props.isOpen) return null;
  if (LoadedModal) return <LoadedModal {...props} />;

  return (
    <Dialog
      isOpen
      title="위시리스트에 저장하기"
      onClose={props.onClose}
      className={requireCssModuleClass(styles.dialog)}
      bodyClassName={requireCssModuleClass(styles.content)}
    >
      {hasError ? (
        <RetryableErrorState
          title="위시리스트 화면을 불러오지 못했어요"
          description="네트워크 연결을 확인한 뒤 다시 시도해주세요."
          action={
            <Button onClick={() => setAttempt((value) => value + 1)}>
              다시 시도
            </Button>
          }
        />
      ) : (
        <LoadingState title="위시리스트 화면을 불러오고 있어요" />
      )}
    </Dialog>
  );
}
