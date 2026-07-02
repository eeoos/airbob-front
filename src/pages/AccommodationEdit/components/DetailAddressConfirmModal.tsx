import React from "react";
import styles from "../AccommodationEdit.module.css";
import { EditModalShell } from "./EditModalShell";

interface DetailAddressConfirmModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export const DetailAddressConfirmModal: React.FC<
  DetailAddressConfirmModalProps
> = ({ onClose, onConfirm }) => {
  const title = "상세 주소 확인";

  return (
    <EditModalShell title={title} modalClassName={styles.confirmModal} onClose={onClose}>
      <div className={styles.confirmModalContent}>
        <h2 className={styles.confirmModalTitle}>{title}</h2>
        <p className={styles.confirmModalMessage}>
          상세주소를 입력하지 않으셨습니다. 이대로 진행하시겠습니까?
        </p>
        <div className={styles.confirmModalButtons}>
          <button
            type="button"
            className={styles.confirmModalButtonCancel}
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className={styles.confirmModalButtonConfirm}
            onClick={onConfirm}
          >
            진행하기
          </button>
        </div>
      </div>
    </EditModalShell>
  );
};
