import React from "react";
import { AccommodationEditStep } from "../hooks/useAccommodationEditForm";
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
  <div className={styles.buttonGroup}>
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
          <span className={styles.loadingDots}>
            <span></span>
            <span></span>
            <span></span>
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
