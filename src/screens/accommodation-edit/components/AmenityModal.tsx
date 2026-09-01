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
  onIncrement: (name: string) => void;
  onDecrement: (name: string) => void;
  onClose: () => void;
}

export const AmenityModal: React.FC<AmenityModalProps> = ({
  amenityInfos,
  options,
  onToggle,
  onIncrement,
  onDecrement,
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
          const currentAmenity = amenityInfos.find(
            (item) => item.name === amenity.name,
          );
          const isSelected = currentAmenity !== undefined;
          const count = currentAmenity?.count || 0;

          return (
            <div key={amenity.name} className={styles.amenityOptionContainer}>
              <button
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
              {isSelected && (
                <div className={styles.amenityCountControl}>
                  <button
                    type="button"
                    className={styles.amenityCountButton}
                    aria-label={`${amenity.label} 수량 감소`}
                    onClick={() => onDecrement(amenity.name)}
                    disabled={count <= 1}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <span className={styles.amenityCountValue}>{count}</span>
                  <button
                    type="button"
                    className={styles.amenityCountButton}
                    aria-label={`${amenity.label} 수량 증가`}
                    onClick={() => onIncrement(amenity.name)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
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
