import React from "react";
import type { AccommodationEditStep } from "../editorViewContract";
import styles from "./EditWizardLayout.module.css";

interface EditWizardNavigationProps {
  currentStep: AccommodationEditStep;
  isSaving: boolean;
  canProceedToNext: boolean;
  onBack: () => void;
  onNext: () => void | Promise<void>;
}

export const EditWizardNavigation: React.FC<EditWizardNavigationProps> = ({
  currentStep,
  isSaving,
  canProceedToNext,
  onBack,
  onNext,
}) => (
  <div className={styles.buttonGroup} role="group" aria-label="단계 이동">
    {currentStep > 1 && (
      <button type="button" className={styles.backButton} onClick={onBack}>
        뒤로
      </button>
    )}
    {currentStep < 5 ? (
      <button
        type="button"
        className={styles.nextButton}
        onClick={onNext}
        disabled={isSaving || !canProceedToNext}
      >
        {isSaving ? (
          <span className={styles.loadingLabel} role="status">
            <span className={styles.loadingDots} aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
            저장 중
          </span>
        ) : (
          "다음"
        )}
      </button>
    ) : (
      <button
        type="submit"
        className={styles.submitButton}
        disabled={isSaving || !canProceedToNext}
      >
        {isSaving ? "저장 중..." : "저장하기"}
      </button>
    )}
  </div>
);
