import React from "react";
import { AccommodationEditStep } from "../hooks/useAccommodationEditForm";
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
  isStepCompleted: (step: Step) => boolean;
  isStepClickable: (step: Step) => boolean;
  onStepClick: (stepNumber: number) => void;
}

export const EditWizardSidebar: React.FC<EditWizardSidebarProps> = ({
  currentStep,
  isStepCompleted,
  isStepClickable,
  onStepClick,
}) => (
  <div className={styles.sidebar}>
    {STEPS.map((step) => {
      const isClickable = isStepClickable(step.number);
      const isCurrent = currentStep === step.number;
      const isCompleted =
        isStepCompleted(step.number) && !isCurrent && step.number !== 5;

      return (
        <button
          key={step.number}
          type="button"
          className={`${styles.stepItem} ${isCurrent ? styles.active : ""} ${
            isCompleted ? styles.completed : ""
          } ${isClickable ? styles.clickable : ""}`}
          disabled={!isClickable}
          aria-current={isCurrent ? "step" : undefined}
          onClick={() => onStepClick(step.number)}
        >
          <div className={styles.stepNumber}>{step.number}</div>
          <div className={styles.stepInfo}>
            <div className={styles.stepItemTitle}>{step.title}</div>
            <div className={styles.stepItemDescription}>{step.description}</div>
          </div>
        </button>
      );
    })}
  </div>
);
