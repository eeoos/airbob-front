import React from "react";
import { useCreateWishlist } from "../../hooks/useCreateWishlist";
import { Dialog } from "../../../../shared/ui";
import { ErrorToast } from "../../../../components/ErrorToast";
import styles from "./CreateWishlistModal.module.css";

interface CreateWishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (wishlistId: number) => void;
}

export const CreateWishlistModal: React.FC<CreateWishlistModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { clearError, error, isLoading, name, submit, updateName } =
    useCreateWishlist({
      isOpen,
      onSuccess,
    });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateName(e.target.value);
  };

  return (
    <Dialog
      isOpen={isOpen}
      title="위시리스트 만들기"
      onClose={onClose}
      className={styles.dialog}
      bodyClassName={styles.content}
    >
      <form onSubmit={submit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label htmlFor="name" className={styles.label}>
            이름
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={handleChange}
            className={styles.input}
            placeholder="위시리스트 이름을 입력하세요"
            maxLength={50}
            required
            autoFocus
          />
          <div className={styles.charCount}>{name.length}/50자</div>
        </div>

        <div className={styles.buttonGroup}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={!name.trim() || isLoading}
          >
            새로 만들기
          </button>
        </div>
      </form>
      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}
    </Dialog>
  );
};
