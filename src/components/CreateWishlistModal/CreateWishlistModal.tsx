import React, { useState, useEffect } from "react";
import { wishlistApi } from "../../api/wishlist";
import { useApiError } from "../../hooks/useApiError";
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
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { error, handleError, clearError } = useApiError();

  useEffect(() => {
    if (isOpen) {
      setName("");
      clearError();
    }
  }, [isOpen, clearError]);

  // 모달이 열릴 때 body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      const response = await wishlistApi.create({ name: name.trim() });
      onSuccess(response.id);
      setName("");
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 50) {
      setName(value);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <button className={styles.backButton} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        <div className={styles.content}>
          <h2 className={styles.title}>위시리스트 만들기</h2>

          <form onSubmit={handleSubmit} className={styles.form}>
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
        </div>
      </div>
    </>
  );
};

