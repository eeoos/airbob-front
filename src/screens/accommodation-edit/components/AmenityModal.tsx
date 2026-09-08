import React from "react";
import { requireCssModuleClass } from "../../../shared/styles/requireCssModuleClass";
import type {
  AccommodationEditAmenityOption,
  AccommodationEditFormData,
} from "../editorViewContract";
import styles from "./EditModal.module.css";
import { AmenityIcon } from "./accommodationEditIcons";
import { EditModalShell } from "./EditModalShell";

interface AmenityModalProps {
  amenityInfos: AccommodationEditFormData["amenityInfos"];
  options: readonly AccommodationEditAmenityOption[];
  onToggle: (name: string) => void;
  onClose: () => void;
}

export const AmenityModal: React.FC<AmenityModalProps> = ({
  amenityInfos,
  options,
  onToggle,
  onClose,
}) => {
  const title = "편의시설을 선택하세요";

  return (
    <EditModalShell
      title={title}
      modalClassName={requireCssModuleClass(styles.typeModal)}
      onClose={onClose}
    >
      <div className={styles.typeModalHeader}>
        <h2 className={styles.typeModalTitle}>{title}</h2>
        <button
          type="button"
          className={styles.typeModalClose}
          onClick={onClose}
          aria-label="모달 닫기"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className={styles.typeModalGrid}>
        {options.map((amenity) => {
          const isSelected = amenityInfos.some(
            (item) => item.name === amenity.name,
          );

          return (
            <button
              key={amenity.name}
              type="button"
              aria-pressed={isSelected}
              className={`${styles.typeOption} ${isSelected ? styles.typeOptionSelected : ""}`}
              onClick={() => onToggle(amenity.name)}
            >
              <div className={styles.typeOptionIcon}>
                <AmenityIcon type={amenity.name} />
              </div>
              <span className={styles.typeOptionLabel}>{amenity.label}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.amenityModalFooter}>
        <button
          type="button"
          className={styles.amenityModalDoneButton}
          onClick={onClose}
        >
          완료
        </button>
      </div>
    </EditModalShell>
  );
};
