import React from "react";
import type {
  AccommodationEditAmenitySemantic,
  AccommodationEditField,
  AccommodationEditFormData,
  AccommodationEditOccupancyField,
} from "../editorViewContract";
import { ACCOMMODATION_TYPE_OPTIONS } from "./editorOptions";
import styles from "./EditForm.module.css";

interface InfoStepProps {
  amenitySemantics: readonly AccommodationEditAmenitySemantic[];
  formData: AccommodationEditFormData;
  onFieldChange: (field: AccommodationEditField, value: string) => void;
  onOccupancyChange: (
    field: AccommodationEditOccupancyField,
    value: boolean,
  ) => void;
  onGuestIncrement: () => void;
  onGuestDecrement: () => void;
  onAmenityIncrement: (name: string) => void;
  onAmenityDecrement: (name: string) => void;
  onAmenityRemove: (name: string) => void;
  onOpenTypeModal: () => void;
  onOpenAmenityModal: () => void;
}

export const InfoStep: React.FC<InfoStepProps> = ({
  amenitySemantics,
  formData,
  onFieldChange,
  onOccupancyChange,
  onGuestIncrement,
  onGuestDecrement,
  onAmenityIncrement,
  onAmenityDecrement,
  onAmenityRemove,
  onOpenTypeModal,
  onOpenAmenityModal,
}) => (
  <div className={styles.stepContent}>
    <h2 className={styles.stepTitle}>숙소 정보를 알려주세요</h2>
    <p className={styles.stepDescription}>숙소의 기본 정보를 입력해주세요.</p>

    <div className={styles.formGroup}>
      <label className={styles.label} htmlFor="accommodation-name">
        숙소 이름 <span className={styles.required}>*</span>
      </label>
      <input
        id="accommodation-name"
        type="text"
        value={formData.name}
        onChange={(e) => onFieldChange("name", e.target.value)}
        className={styles.input}
        placeholder="예: 편안한 아파트"
        required
        maxLength={50}
      />
    </div>

    <div className={styles.formGroup}>
      <label className={styles.label} htmlFor="accommodation-description">
        숙소 설명 <span className={styles.required}>*</span>
      </label>
      <textarea
        id="accommodation-description"
        value={formData.description}
        onChange={(e) => onFieldChange("description", e.target.value)}
        className={styles.textarea}
        placeholder="숙소에 대한 자세한 설명을 입력해주세요."
        required
        maxLength={5000}
        rows={8}
      />
    </div>

    <div className={styles.formGroup}>
      <span className={styles.label}>
        숙소 유형 <span className={styles.required}>*</span>
      </span>
      <button
        type="button"
        className={styles.typeSelectButton}
        onClick={onOpenTypeModal}
      >
        {ACCOMMODATION_TYPE_OPTIONS.find((t) => t.value === formData.type)
          ?.label || "숙소 유형 선택"}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>

    <div className={styles.formGroup}>
      <label className={styles.label} htmlFor="accommodation-base-price">
        기본 가격 (원) <span className={styles.required}>*</span>
      </label>
      <input
        id="accommodation-base-price"
        type="number"
        value={formData.basePrice}
        onChange={(e) => onFieldChange("basePrice", e.target.value)}
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
          <span className={styles.quantityLabel}>
            게스트 <span className={styles.required}>*</span>
          </span>
          <div className={styles.quantitySelector}>
            <button
              type="button"
              aria-label="최대 게스트 수 줄이기"
              className={styles.quantityButton}
              onClick={onGuestDecrement}
              disabled={Number(formData.occupancyPolicyInfo.maxOccupancy) <= 1}
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
            <span className={styles.quantityValue}>
              {formData.occupancyPolicyInfo.maxOccupancy || "1"}
            </span>
            <button
              type="button"
              aria-label="최대 게스트 수 늘리기"
              className={styles.quantityButton}
              onClick={onGuestIncrement}
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
        </div>
        <p className={styles.helperText}>최대 수용 가능한 게스트 수입니다.</p>
      </div>

      <div className={styles.formGroup}>
        <div className={styles.checkboxRow}>
          <span className={styles.checkboxTextLabel}>유아</span>
          <div className={styles.checkboxLabel}>
            <input
              aria-label="유아 수용 가능"
              type="checkbox"
              checked={formData.occupancyPolicyInfo.infantOccupancy}
              onChange={(e) =>
                onOccupancyChange("infantOccupancy", e.target.checked)
              }
              className={styles.checkbox}
            />
          </div>
        </div>
        <p className={styles.helperText}>유아 수용 가능 여부입니다.</p>
      </div>

      <div className={styles.formGroup}>
        <div className={styles.checkboxRow}>
          <span className={styles.checkboxTextLabel}>반려동물</span>
          <div className={styles.checkboxLabel}>
            <input
              aria-label="반려동물 수용 가능"
              type="checkbox"
              checked={formData.occupancyPolicyInfo.petOccupancy}
              onChange={(e) =>
                onOccupancyChange("petOccupancy", e.target.checked)
              }
              className={styles.checkbox}
            />
          </div>
        </div>
        <p className={styles.helperText}>반려동물 수용 가능 여부입니다.</p>
      </div>
    </div>

    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>편의시설</h3>
      {formData.amenityInfos.length > 0 && (
        <div className={styles.selectedAmenitiesList}>
          {formData.amenityInfos.map((amenity, index) => {
            const semanticAmenity = amenitySemantics.find(
              ({ name }) => name === amenity.name,
            );
            const amenityLabel = semanticAmenity?.label ?? amenity.name;

            return (
              <div
                key={`${amenity.name}-${index}`}
                className={styles.selectedAmenityItem}
                data-amenity-code={amenity.name}
                data-amenity-known={semanticAmenity?.isKnown ?? false}
              >
                <span className={styles.selectedAmenityName}>
                  {amenityLabel}
                </span>
                <div className={styles.amenityCountSelector}>
                  <button
                    type="button"
                    className={styles.amenityCountButton}
                    aria-label={`${amenityLabel} 수량 감소`}
                    onClick={() => {
                      if (amenity.count <= 1) {
                        onAmenityRemove(amenity.name);
                        return;
                      }
                      onAmenityDecrement(amenity.name);
                    }}
                    disabled={amenity.count <= 0}
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
                  <span className={styles.amenityCountValue}>
                    {amenity.count}
                  </span>
                  <button
                    type="button"
                    className={styles.amenityCountButton}
                    aria-label={`${amenityLabel} 수량 증가`}
                    onClick={() => onAmenityIncrement(amenity.name)}
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
                <button
                  type="button"
                  className={styles.amenityRemoveButton}
                  aria-label={`${amenityLabel} 제거`}
                  onClick={() => onAmenityRemove(amenity.name)}
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
            );
          })}
        </div>
      )}
      <button
        type="button"
        className={styles.addAmenityButton}
        onClick={onOpenAmenityModal}
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
        편의시설 추가
      </button>
    </div>
  </div>
);
