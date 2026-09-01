import { useCallback, useEffect, useRef, useState } from "react";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import { Button, Dialog } from "../../../../shared/ui";
import {
  toWishlistErrorMessage,
  WISHLIST_CREATED_ONLY_MESSAGE,
} from "../wishlistErrorMessage";
import type {
  CreateAndAddWishlistCommandResult,
  WishlistMembershipCommandPort,
} from "../../ports/wishlistMembershipCommandPort";
import styles from "./CreateWishlistModal.module.css";

export interface CreateWishlistModalProps {
  readonly accommodationId: number;
  readonly commands: Pick<
    WishlistMembershipCommandPort,
    "createAndAddAccommodation"
  >;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onComplete: (
    result: Extract<
      CreateAndAddWishlistCommandResult,
      { readonly status: "applied" | "applied-unconfirmed" }
    >,
  ) => void;
}

export function CreateWishlistModal({
  accommodationId,
  commands,
  isOpen,
  onClose,
  onComplete,
}: CreateWishlistModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [name, setName] = useState("");
  const interactionGenerationRef = useRef(0);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    interactionGenerationRef.current += 1;
    pendingRef.current = false;

    if (isOpen) {
      setError(null);
      setIsPending(false);
      setName("");
    }
  }, [accommodationId, isOpen]);

  const handleClose = useCallback(() => {
    interactionGenerationRef.current += 1;
    pendingRef.current = false;
    setError(null);
    setIsPending(false);
    onClose();
  }, [onClose]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      setName(event.target.value.slice(0, 50));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const normalizedName = name.trim();
      if (!normalizedName || pendingRef.current) return;

      const generation = interactionGenerationRef.current;
      pendingRef.current = true;
      setError(null);
      setIsPending(true);

      try {
        const result = await commands.createAndAddAccommodation({
          accommodationId,
          name: normalizedName,
        });

        if (generation !== interactionGenerationRef.current) return;

        if (result.status === "created-only") {
          setError(WISHLIST_CREATED_ONLY_MESSAGE);
          return;
        }

        if (
          result.status === "applied" ||
          result.status === "applied-unconfirmed"
        ) {
          setName("");
          onComplete(result);
        }
      } catch (submissionError) {
        if (generation === interactionGenerationRef.current) {
          setError(toWishlistErrorMessage(submissionError));
        }
      } finally {
        if (generation === interactionGenerationRef.current) {
          pendingRef.current = false;
          setIsPending(false);
        }
      }
    },
    [accommodationId, commands, name, onComplete],
  );

  return (
    <Dialog
      initialFocusRef={nameInputRef}
      isOpen={isOpen}
      title="위시리스트 만들기"
      onClose={handleClose}
      className={requireCssModuleClass(styles.dialog)}
      bodyClassName={requireCssModuleClass(styles.content)}
    >
      <form
        aria-busy={isPending || undefined}
        onSubmit={handleSubmit}
        className={styles.form}
      >
        <p className={styles.description}>
          여행 목적이나 계절처럼 나중에도 알아보기 쉬운 이름을 붙여 보세요.
        </p>
        <div className={styles.inputGroup}>
          <label htmlFor="wishlist-name" className={styles.label}>
            이름
          </label>
          <input
            aria-describedby={`wishlist-name-help wishlist-name-count${
              error ? " wishlist-create-error" : ""
            }`}
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            disabled={isPending}
            ref={nameInputRef}
            type="text"
            id="wishlist-name"
            value={name}
            onChange={handleChange}
            className={styles.input}
            placeholder="예: 가을 제주 여행"
            maxLength={50}
            required
          />
          <div className={styles.inputMeta}>
            <span id="wishlist-name-help">이름은 나중에 변경할 수 있어요.</span>
            <span aria-live="polite" id="wishlist-name-count">
              {name.length}/50자
            </span>
          </div>
        </div>

        {error && (
          <div
            className={styles.errorPanel}
            id="wishlist-create-error"
            role="alert"
          >
            <strong>숙소 저장을 완료하지 못했어요</strong>
            <span>{error}</span>
            <span>
              입력한 이름을 유지했어요. 같은 내용으로 다시 시도하세요.
            </span>
          </div>
        )}

        <div className={styles.buttonGroup}>
          <Button
            className={styles.cancelButton}
            onClick={handleClose}
            size="md"
            variant="secondary"
          >
            취소
          </Button>
          <Button
            type="submit"
            className={styles.submitButton}
            disabled={!name.trim() || isPending}
            isLoading={isPending}
            loadingLabel="저장 중..."
            size="md"
          >
            {error ? "다시 시도" : "새로 만들기"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
