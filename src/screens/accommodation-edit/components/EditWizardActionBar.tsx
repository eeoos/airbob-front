import React from "react";
import styles from "./EditWizardLayout.module.css";

interface EditWizardActionBarProps {
  isSaving: boolean;
  onSaveAndExit: () => void;
}

export const EditWizardActionBar: React.FC<EditWizardActionBarProps> = ({
  isSaving,
  onSaveAndExit,
}) => (
  <header className={styles.header}>
    <div className={styles.titleGroup}>
      <h1 className={styles.title}>숙소 등록</h1>
      <p className={styles.headerDescription}>
        게스트가 머무를 공간을 단계별로 완성해 보세요.
      </p>
    </div>
    <button
      type="button"
      className={styles.saveAndExitButton}
      onClick={onSaveAndExit}
      disabled={isSaving}
    >
      저장 후 나가기
    </button>
  </header>
);
