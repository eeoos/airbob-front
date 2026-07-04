import React from "react";
import {
  AccommodationEditFormData,
} from "../lib/accommodationEditMapper";
import {
  DEFAULT_ACCOMMODATION_TYPE_OPTIONS,
  DEFAULT_AMENITY_OPTIONS,
} from "../../../../utils/codes";
import styles from "./EditForm.module.css";

type NestedFormFields = {
  addressInfo: AccommodationEditFormData["addressInfo"];
  occupancyPolicyInfo: AccommodationEditFormData["occupancyPolicyInfo"];
};

interface InfoStepProps {
  formData: AccommodationEditFormData;
  onInputChange: <K extends keyof AccommodationEditFormData>(
    field: K,
    value: AccommodationEditFormData[K]
  ) => void;
  onNestedChange: <
    P extends keyof NestedFormFields,
    K extends keyof NestedFormFields[P]
  >(
    parent: P,
    field: K,
    value: NestedFormFields[P][K]
  ) => void;
  setFormData: React.Dispatch<React.SetStateAction<AccommodationEditFormData>>;
  setSelectedAmenities: React.Dispatch<React.SetStateAction<Set<string>>>;
  onOpenTypeModal: () => void;
  onOpenAmenityModal: () => void;
}

export const InfoStep: React.FC<InfoStepProps> = ({
  formData,
  onInputChange,
  onNestedChange,
  setFormData,
  setSelectedAmenities,
  onOpenTypeModal,
  onOpenAmenityModal,
}) => (
  <div className={styles.stepContent}>
    <h2 className={styles.stepTitle}>숙소 정보를 알려주세요</h2>
    <p className={styles.stepDescription}>숙소의 기본 정보를 입력해주세요.</p>

    <div className={styles.formGroup}>
      <label className={styles.label}>
        숙소 이름 <span className={styles.required}>*</span>
      </label>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => onInputChange("name", e.target.value)}
        className={styles.input}
        placeholder="예: 편안한 아파트"
        required
        maxLength={50}
      />
    </div>

    <div className={styles.formGroup}>
      <label className={styles.label}>
        숙소 설명 <span className={styles.required}>*</span>
      </label>
      <textarea
        value={formData.description}
        onChange={(e) => onInputChange("description", e.target.value)}
        className={styles.textarea}
        placeholder="숙소에 대한 자세한 설명을 입력해주세요."
        required
        maxLength={5000}
        rows={8}
      />
    </div>

    <div className={styles.formGroup}>
      <label className={styles.label}>
        숙소 유형 <span className={styles.required}>*</span>
      </label>
      <button
        type="button"
        className={styles.typeSelectButton}
        onClick={onOpenTypeModal}
      >
        {DEFAULT_ACCOMMODATION_TYPE_OPTIONS.find((t) => t.value === formData.type)
          ?.label || "숙소 유형 선택"}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>

    <div className={styles.formGroup}>
      <label className={styles.label}>
        기본 가격 (원) <span className={styles.required}>*</span>
      </label>
      <input
        type="number"
        value={formData.basePrice}
        onChange={(e) => onInputChange("basePrice", e.target.value)}
        className={`${styles.input} ${styles.priceInput}`}
        placeholder="50000"
        required
        min={5000}
      />
      <p className={styles.helperText}>1박 기준 가격입니다.</p>
    </div>

    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>수용 인원</h3>
      <div className={styles.formGroup}>
        <div className={styles.quantityRow}>
          <label className={styles.quantityLabel}>
            게스트 <span className={styles.required}>*</span>
          </label>
          <div className={styles.quantitySelector}>
            <button
              type="button"
              className={styles.quantityButton}
              onClick={() => {
                const current = Number(formData.occupancyPolicyInfo.maxOccupancy) || 1;
                if (current > 1) {
                  onNestedChange(
                    "occupancyPolicyInfo",
                    "maxOccupancy",
                    String(current - 1)
                  );
                }
              }}
              disabled={Number(formData.occupancyPolicyInfo.maxOccupancy) <= 1}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <span className={styles.quantityValue}>
              {formData.occupancyPolicyInfo.maxOccupancy || "1"}
            </span>
            <button
              type="button"
              className={styles.quantityButton}
              onClick={() => {
                const current = Number(formData.occupancyPolicyInfo.maxOccupancy) || 1;
                onNestedChange(
                  "occupancyPolicyInfo",
                  "maxOccupancy",
                  String(current + 1)
                );
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
        <p className={styles.helperText}>최대 수용 가능한 게스트 수입니다.</p>
      </div>

      <div className={styles.formGroup}>
        <div className={styles.checkboxRow}>
          <label className={styles.checkboxTextLabel}>유아</label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={formData.occupancyPolicyInfo.infantOccupancy}
              onChange={(e) =>
                onNestedChange(
                  "occupancyPolicyInfo",
                  "infantOccupancy",
                  e.target.checked
                )
              }
              className={styles.checkbox}
            />
          </label>
        </div>
        <p className={styles.helperText}>유아 수용 가능 여부입니다.</p>
      </div>

      <div className={styles.formGroup}>
        <div className={styles.checkboxRow}>
          <label className={styles.checkboxTextLabel}>반려동물</label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={formData.occupancyPolicyInfo.petOccupancy}
              onChange={(e) =>
                onNestedChange(
                  "occupancyPolicyInfo",
                  "petOccupancy",
                  e.target.checked
                )
              }
              className={styles.checkbox}
            />
          </label>
        </div>
        <p className={styles.helperText}>반려동물 수용 가능 여부입니다.</p>
      </div>
    </div>

    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>편의시설</h3>
      {formData.amenityInfos.length > 0 && (
        <div className={styles.selectedAmenitiesList}>
          {formData.amenityInfos.map((amenity, index) => (
            <div key={`${amenity.name}-${index}`} className={styles.selectedAmenityItem}>
              <span className={styles.selectedAmenityName}>
                {DEFAULT_AMENITY_OPTIONS.find((a) => a.value === amenity.name)
                  ?.label || amenity.name}
              </span>
              <div className={styles.amenityCountSelector}>
                <button
                  type="button"
                  className={styles.amenityCountButton}
                  onClick={() => {
                    const newAmenities = [...formData.amenityInfos];
                    if (amenity.count > 0) {
                      newAmenities[index] = { ...amenity, count: amenity.count - 1 };
                      if (newAmenities[index].count === 0) {
                        newAmenities.splice(index, 1);
                        setSelectedAmenities((prev) => {
                          const next = new Set(prev);
                          next.delete(amenity.name);
                          return next;
                        });
                      }
                      setFormData((prev) => ({ ...prev, amenityInfos: newAmenities }));
                    }
                  }}
                  disabled={amenity.count <= 0}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <span className={styles.amenityCountValue}>{amenity.count}</span>
                <button
                  type="button"
                  className={styles.amenityCountButton}
                  onClick={() => {
                    const newAmenities = [...formData.amenityInfos];
                    newAmenities[index] = { ...amenity, count: amenity.count + 1 };
                    setFormData((prev) => ({ ...prev, amenityInfos: newAmenities }));
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                className={styles.amenityRemoveButton}
                onClick={() => {
                  const newAmenities = formData.amenityInfos.filter(
                    (_, itemIndex) => itemIndex !== index
                  );
                  setFormData((prev) => ({ ...prev, amenityInfos: newAmenities }));
                  setSelectedAmenities((prev) => {
                    const next = new Set(prev);
                    next.delete(amenity.name);
                    return next;
                  });
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className={styles.addAmenityButton}
        onClick={() => {
          setSelectedAmenities(new Set(formData.amenityInfos.map((a) => a.name)));
          onOpenAmenityModal();
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        편의시설 추가
      </button>
    </div>
  </div>
);
