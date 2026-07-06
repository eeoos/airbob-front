import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "../../../../shared/ui";
import { useAccommodationActions } from "../../hooks/useAccommodationActions";
import { ErrorToast } from "../../../../components/ErrorToast";
import { getImageUrl } from "../../../../utils/image";
import { routeTo } from "../../../../routes/paths";
import styles from "./AccommodationActionModal.module.css";

export interface AccommodationActionViewModel {
  canOpenDetail: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  id: number;
  imageAlt: string;
  name: string;
  thumbnailUrl: string | null;
}

interface AccommodationActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accommodation: AccommodationActionViewModel | null;
  onSuccess?: () => void;
}

export const AccommodationActionModal: React.FC<AccommodationActionModalProps> = ({
  isOpen,
  onClose,
  accommodation,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const {
    clearError,
    deleteAccommodation,
    error,
    isProcessing,
    publishAccommodation,
    unpublishAccommodation,
  } = useAccommodationActions({
    onClose,
    onSuccess,
  });

  useEffect(() => {
    if (!isOpen) {
      clearError();
    }
  }, [isOpen, clearError]);

  if (!isOpen || !accommodation) return null;

  const handleEdit = () => {
    navigate(routeTo.accommodationEdit(accommodation.id));
    onClose();
  };

  const handlePublish = async () => {
    await publishAccommodation(accommodation.id);
  };

  const handleUnpublish = async () => {
    await unpublishAccommodation(accommodation.id);
  };

  const handleDelete = async () => {
    await deleteAccommodation(accommodation.id);
  };

  return (
    <Dialog
      bodyClassName={styles.content}
      bodyPadding="none"
      className={styles.dialog}
      isOpen={isOpen}
      onClose={onClose}
      showHeader={false}
      size="sm"
      title="숙소 관리"
    >
      <button
        aria-label="숙소 관리 닫기"
        autoFocus
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
          onClick={() => {
            navigate(routeTo.accommodationDetail(accommodation.id));
            onClose();
          }}
        >
          <div className={styles.imageContainer}>
            {accommodation.thumbnailUrl ? (
              <img
                src={getImageUrl(accommodation.thumbnailUrl)}
                alt={accommodation.imageAlt}
                className={styles.image}
              />
            ) : (
              <div className={styles.placeholder} />
            )}
          </div>

          <div className={styles.name}>{accommodation.name}</div>
        </button>
      ) : (
        <>
          <div className={styles.imageContainer}>
            {accommodation.thumbnailUrl ? (
              <img
                src={getImageUrl(accommodation.thumbnailUrl)}
                alt={accommodation.imageAlt}
                className={styles.image}
              />
            ) : (
              <div className={styles.placeholder} />
            )}
          </div>

          <div className={styles.name}>{accommodation.name}</div>
        </>
      )}

      <div className={styles.actions}>
        <button
          className={styles.editButton}
          disabled={isProcessing}
          type="button"
          onClick={handleEdit}
        >
          리스팅 수정
        </button>

        {accommodation.canUnpublish && (
          <button
            className={styles.actionButton}
            disabled={isProcessing}
            type="button"
            onClick={handleUnpublish}
          >
            리스팅 비공개
          </button>
        )}

        {accommodation.canPublish && (
          <button
            className={styles.actionButton}
            disabled={isProcessing}
            type="button"
            onClick={handlePublish}
          >
            리스팅 공개
          </button>
        )}

        <button
          className={styles.deleteButton}
          disabled={isProcessing}
          type="button"
          onClick={handleDelete}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
          리스팅 삭제
        </button>
      </div>

      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}
    </Dialog>
  );
};
