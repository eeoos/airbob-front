import React from "react";
import { DEFAULT_ACCOMMODATION_TYPE_OPTIONS } from "../../../utils/codes";
import styles from "../AccommodationEdit.module.css";
import { AccommodationTypeIcon } from "./accommodationEditIcons";

interface AccommodationTypeModalProps {
  selectedType: string;
  onSelect: (type: string) => void;
  onClose: () => void;
}

export const AccommodationTypeModal: React.FC<AccommodationTypeModalProps> = ({
  selectedType,
  onSelect,
  onClose,
}) => (
  <div className={styles.typeModalOverlay} onClick={onClose}>
    <div className={styles.typeModal} onClick={(e) => e.stopPropagation()}>
      <div className={styles.typeModalHeader}>
        <h2 className={styles.typeModalTitle}>다음 중 숙소를 가장 잘 설명하는 것은 무엇인가요?</h2>
        <button type="button" className={styles.typeModalClose} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className={styles.typeModalGrid}>
        {DEFAULT_ACCOMMODATION_TYPE_OPTIONS.map((type) => (
          <button
            key={type.value}
            type="button"
            className={`${styles.typeOption} ${selectedType === type.value ? styles.typeOptionSelected : ""}`}
            onClick={() => {
              onSelect(type.value);
              onClose();
            }}
          >
            <div className={styles.typeOptionIcon}>
              <AccommodationTypeIcon type={type.value} />
            </div>
            <span className={styles.typeOptionLabel}>{type.label}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);
