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
  <div className={styles.header}>
    <h1 className={styles.title}>숙소 등록</h1>
    <button
      type="button"
      className={styles.saveAndExitButton}
      onClick={onSaveAndExit}
      disabled={isSaving}
    >
      저장 후 나가기
    </button>
  </div>
);
