import React from "react";
import styles from "./EditForm.module.css";

export const PublishStep: React.FC = () => (
  <div className={styles.stepContent}>
    <h2 className={styles.stepTitle}>숙소를 등록하세요</h2>
    <p className={styles.stepDescription}>
      입력한 내용을 한 번 더 살펴본 뒤 Airbob 게스트에게 숙소를 공개하세요.
    </p>
    <section
      className={styles.publishPanel}
      aria-labelledby="publish-checklist"
    >
      <p className={styles.publishEyebrow}>공개 전 마지막 확인</p>
      <h3 id="publish-checklist" className={styles.publishTitle}>
        이 내용이 게스트에게 안내됩니다
      </h3>
      <ul className={styles.publishChecklist}>
        <li>숙소 위치와 상세 주소</li>
        <li>커버 사진과 사진 순서</li>
        <li>숙소 정보, 가격과 편의시설</li>
        <li>체크인·체크아웃 시간</li>
      </ul>
    </section>
  </div>
);
