import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MyAccommodationInfo } from "../../types/accommodation";
import { AccommodationStatus } from "../../types/enums";
import { useAccommodationActions } from "../../features/accommodations/hooks/useAccommodationActions";
import { ErrorToast } from "../ErrorToast";
import { getImageUrl } from "../../utils/image";
import { routeTo } from "../../routes/paths";
import styles from "./AccommodationActionModal.module.css";

interface AccommodationActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accommodation: MyAccommodationInfo | null;
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
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      clearError();
    }

    return () => {
      document.body.style.overflow = "unset";
    };
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
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        <div className={styles.content}>
          {accommodation.status === AccommodationStatus.PUBLISHED ? (
            <div 
              className={styles.accommodationHeader}
              onClick={() => {
                navigate(routeTo.accommodationDetail(accommodation.id));
                onClose();
              }}
            >
              <div className={styles.imageContainer}>
                {accommodation.thumbnail_url ? (
                  <img
                    src={getImageUrl(accommodation.thumbnail_url)}
                    alt={accommodation.name || "숙소"}
                    className={styles.image}
                  />
                ) : (
                  <div className={styles.placeholder} />
                )}
              </div>

              <div className={styles.name}>
                {accommodation.name || "이름 없음"}
              </div>
            </div>
          ) : (
            <>
              <div className={styles.imageContainer}>
                {accommodation.thumbnail_url ? (
                  <img
                    src={getImageUrl(accommodation.thumbnail_url)}
                    alt={accommodation.name || "숙소"}
                    className={styles.image}
                  />
                ) : (
                  <div className={styles.placeholder} />
                )}
              </div>

              <div className={styles.name}>
                {accommodation.name || "이름 없음"}
              </div>
            </>
          )}

          <div className={styles.actions}>
            <button
              className={styles.editButton}
              onClick={handleEdit}
              disabled={isProcessing}
            >
              리스팅 수정
            </button>

            {accommodation.status === AccommodationStatus.PUBLISHED && (
              <button
                className={styles.actionButton}
                onClick={handleUnpublish}
                disabled={isProcessing}
              >
                리스팅 비공개
              </button>
            )}

            {accommodation.status === AccommodationStatus.UNPUBLISHED && (
              <button
                className={styles.actionButton}
                onClick={handlePublish}
                disabled={isProcessing}
              >
                리스팅 공개
              </button>
            )}

            <button
              className={styles.deleteButton}
              onClick={handleDelete}
              disabled={isProcessing}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
              리스팅 삭제
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.toastContainer}>
            <ErrorToast message={error} onClose={clearError} />
          </div>
        )}
      </div>
    </>
  );
};

