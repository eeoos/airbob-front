import React from "react";
import type { AccommodationEditStep } from "../editorViewContract";
import styles from "./EditWizardLayout.module.css";

type Step = AccommodationEditStep;

const STEPS: Array<{
  number: Step;
  title: string;
  description: string;
}> = [
  { number: 1, title: "위치", description: "숙소 위치를 설정하세요" },
  { number: 2, title: "숙소 사진", description: "숙소 사진을 등록하세요" },
  { number: 3, title: "숙소 정보", description: "기본 정보를 입력하세요" },
  {
    number: 4,
    title: "체크인/체크아웃",
    description: "체크인/체크아웃 시간을 설정하세요",
  },
  { number: 5, title: "숙소 등록", description: "숙소를 등록하세요" },
];

interface EditWizardSidebarProps {
  currentStep: Step;
  isInteractionDisabled: boolean;
  isStepCompleted: (step: Step) => boolean;
  isStepClickable: (step: Step) => boolean;
  onStepClick: (stepNumber: Step) => void;
}

export const EditWizardSidebar: React.FC<EditWizardSidebarProps> = ({
  currentStep,
  isInteractionDisabled,
  isStepCompleted,
  isStepClickable,
  onStepClick,
}) => (
  <nav className={styles.sidebar} aria-label="숙소 등록 진행 단계">
    <div className={styles.sidebarHeader}>
      <p className={styles.sidebarEyebrow}>등록 진행률</p>
      <p className={styles.sidebarProgress} aria-live="polite">
        5단계 중 {currentStep}단계
      </p>
    </div>
    <ol className={styles.stepList}>
      {STEPS.map((step) => {
        const isClickable =
          !isInteractionDisabled && isStepClickable(step.number);
        const isCurrent = currentStep === step.number;
        const isCompleted =
          isStepCompleted(step.number) && !isCurrent && step.number !== 5;

        return (
          <li key={step.number} className={styles.stepListItem}>
            <button
              type="button"
              className={`${styles.stepItem} ${isCurrent ? styles.active : ""} ${
                isCompleted ? styles.completed : ""
              } ${isClickable ? styles.clickable : ""}`}
              disabled={!isClickable}
              aria-label={`${step.number} ${step.title} ${step.description}${
                isCompleted ? " 완료됨" : ""
              }`}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => onStepClick(step.number)}
            >
              <span className={styles.stepNumber}>{step.number}</span>
              <span className={styles.stepInfo}>
                <span className={styles.stepItemTitle}>{step.title}</span>
                <span className={styles.stepItemDescription}>
                  {step.description}
                </span>
                {isCompleted && <span className={styles.srOnly}>완료됨</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  </nav>
);
