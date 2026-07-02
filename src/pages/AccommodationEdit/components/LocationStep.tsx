import React from "react";
import { AccommodationEditFormData } from "../../../features/accommodations/edit/lib/accommodationEditMapper";
import styles from "../AccommodationEdit.module.css";

interface LocationStepProps {
  addressInfo: AccommodationEditFormData["addressInfo"];
  onAddressSearch: () => void;
  onDetailChange: (value: string) => void;
}

export const LocationStep: React.FC<LocationStepProps> = ({
  addressInfo,
  onAddressSearch,
  onDetailChange,
}) => (
  <div className={styles.stepContent}>
    <h2 className={styles.stepTitle}>숙소 위치를 알려주세요</h2>
    <p className={styles.stepDescription}>숙소의 정확한 위치를 입력해주세요.</p>

    <div className={styles.formGroup}>
      <label className={styles.label}>
        주소 검색 <span className={styles.required}>*</span>
      </label>
      <div className={styles.addressSearchContainer}>
        <input
          type="text"
          value={addressInfo.street || ""}
          className={styles.input}
          placeholder="주소를 검색하세요"
          readOnly
        />
        <button
          type="button"
          className={styles.addressSearchButton}
          onClick={onAddressSearch}
        >
          주소 검색
        </button>
      </div>
      <p className={styles.helperText}>주소 검색 버튼을 클릭하여 주소를 검색하세요.</p>
    </div>

    <div className={styles.formGroup}>
      <label className={styles.label}>상세 주소</label>
      <input
        type="text"
        value={addressInfo.detail}
        onChange={(e) => onDetailChange(e.target.value)}
        className={styles.input}
        placeholder="101호 또는 건물명, 동/호수 등을 입력하세요"
      />
      <p className={styles.helperText}>상세 주소(동/호수 등)를 입력해주세요. (선택사항)</p>
    </div>
  </div>
);
