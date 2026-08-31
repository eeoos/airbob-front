import { useCallback, useEffect, useRef, useState } from "react";
import { requireCssModuleClass } from "../../../../shared/styles/requireCssModuleClass";
import { Dialog, ToastHost } from "../../../../shared/ui";
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
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label htmlFor="wishlist-name" className={styles.label}>
            이름
          </label>
          <input
            ref={nameInputRef}
            type="text"
            id="wishlist-name"
            value={name}
            onChange={handleChange}
            className={styles.input}
            placeholder="위시리스트 이름을 입력하세요"
            maxLength={50}
            required
          />
          <div className={styles.charCount}>{name.length}/50자</div>
        </div>

        <div className={styles.buttonGroup}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={handleClose}
          >
            취소
          </button>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={!name.trim() || isPending}
          >
            새로 만들기
          </button>
        </div>
      </form>
      {error && (
        <div className={styles.toastContainer}>
          <ToastHost
            closeLabel="오류 닫기"
            message={error}
            onClose={() => setError(null)}
          />
        </div>
      )}
    </Dialog>
  );
}
