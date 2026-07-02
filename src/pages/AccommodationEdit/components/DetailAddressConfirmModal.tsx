import React from "react";
import styles from "../AccommodationEdit.module.css";

interface DetailAddressConfirmModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export const DetailAddressConfirmModal: React.FC<
  DetailAddressConfirmModalProps
> = ({ onClose, onConfirm }) => (
  <div className={styles.typeModalOverlay} onClick={onClose}>
    <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
      <div className={styles.confirmModalContent}>
        <h2 className={styles.confirmModalTitle}>상세 주소 확인</h2>
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
    </div>
  </div>
);
