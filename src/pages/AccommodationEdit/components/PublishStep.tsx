import React from "react";
import styles from "../AccommodationEdit.module.css";

export const PublishStep: React.FC = () => (
  <div className={styles.stepContent}>
    <h2 className={styles.stepTitle}>숙소를 등록하세요</h2>
    <p className={styles.stepDescription}>모든 정보를 확인하고 숙소를 등록하세요.</p>
    <p className={styles.helperText}>저장하기 버튼을 클릭하면 숙소가 공개됩니다.</p>
  </div>
);
