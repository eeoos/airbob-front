import React from "react";
import {
  AccommodationEditFormData,
} from "../../../features/accommodations/edit/lib/accommodationEditMapper";
import { DEFAULT_AMENITY_OPTIONS } from "../../../utils/codes";
import styles from "../AccommodationEdit.module.css";
import { AmenityIcon } from "./accommodationEditIcons";

interface AmenityModalProps {
  amenityInfos: AccommodationEditFormData["amenityInfos"];
  selectedAmenities: Set<string>;
  setFormData: React.Dispatch<React.SetStateAction<AccommodationEditFormData>>;
  setSelectedAmenities: React.Dispatch<React.SetStateAction<Set<string>>>;
  onClose: () => void;
}

export const AmenityModal: React.FC<AmenityModalProps> = ({
  amenityInfos,
  selectedAmenities,
  setFormData,
  setSelectedAmenities,
  onClose,
}) => {
  const toggleAmenity = (amenityValue: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedAmenities((prev) => {
        const next = new Set(prev);
        next.delete(amenityValue);
        return next;
      });
      setFormData((prev) => ({
        ...prev,
        amenityInfos: prev.amenityInfos.filter(
          (item) => item.name !== amenityValue
        ),
      }));
      return;
    }

    setSelectedAmenities((prev) => new Set(prev).add(amenityValue));
    setFormData((prev) => ({
      ...prev,
      amenityInfos: [
        ...prev.amenityInfos,
        { name: amenityValue, count: 1 },
      ],
    }));
  };

  return (
    <div className={styles.typeModalOverlay} onClick={onClose}>
      <div className={styles.typeModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.typeModalHeader}>
          <h2 className={styles.typeModalTitle}>편의시설을 선택하세요</h2>
          <button type="button" className={styles.typeModalClose} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={styles.typeModalGrid}>
          {DEFAULT_AMENITY_OPTIONS.map((amenity) => {
            const isSelected = selectedAmenities.has(amenity.value);
            const currentAmenity = amenityInfos.find((item) => item.name === amenity.value);
            const count = currentAmenity?.count || 0;

            return (
              <div key={amenity.value} className={styles.amenityOptionContainer}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  className={`${styles.typeOption} ${isSelected ? styles.typeOptionSelected : ""}`}
                  onClick={() => toggleAmenity(amenity.value, isSelected)}
                  onKeyDown={(event) => {
                    if (event.currentTarget !== event.target) {
                      return;
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleAmenity(amenity.value, isSelected);
                    }
                  }}
                >
                  <div className={styles.typeOptionIcon}>
                    <AmenityIcon type={amenity.value} />
                  </div>
                  {isSelected && (
                    <div className={styles.amenityCountControl}>
                      <button
                        type="button"
                        className={styles.amenityCountButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (count > 1) {
                            setFormData((prev) => ({
                              ...prev,
                              amenityInfos: prev.amenityInfos.map((item) =>
                                item.name === amenity.value
                                  ? { ...item, count: count - 1 }
                                  : item
                              ),
                            }));
                          }
                        }}
                        disabled={count <= 1}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                      <span className={styles.amenityCountValue}>{count}</span>
                      <button
                        type="button"
                        className={styles.amenityCountButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData((prev) => ({
                            ...prev,
                            amenityInfos: prev.amenityInfos.map((item) =>
                              item.name === amenity.value
                                ? { ...item, count: count + 1 }
                                : item
                            ),
                          }));
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <span className={styles.typeOptionLabel}>{amenity.label}</span>
                </div>
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
      </div>
    </div>
  );
};
