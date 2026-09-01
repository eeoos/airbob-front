import React from "react";
import {
  Button,
  RetryableErrorState,
  Skeleton,
  stateViewRecipes,
  TerminalErrorState,
} from "../../shared/ui";
import { EditStepContent } from "./components/EditStepContent";
import { EditWizardActionBar } from "./components/EditWizardActionBar";
import { EditWizardDialogs } from "./components/EditWizardDialogs";
import styles from "./components/EditWizardLayout.module.css";
import { EditWizardNavigation } from "./components/EditWizardNavigation";
import { EditWizardSidebar } from "./components/EditWizardSidebar";
import type { AccommodationEditScreenProps } from "./editorViewContract";

const EditorLoading = () => (
  <section className={styles.loading} {...stateViewRecipes.loading}>
    <p className={styles.srOnly}>숙소 작업 공간을 준비하는 중입니다.</p>
    <div className={styles.loadingHeader}>
      <Skeleton className={styles.loadingEyebrow} />
      <Skeleton className={styles.loadingTitle} />
      <Skeleton className={styles.loadingDescription} />
    </div>
    <div className={styles.loadingWorkspace}>
      <div className={styles.loadingSteps}>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className={styles.loadingStep} />
        ))}
      </div>
      <div className={styles.loadingForm}>
        <Skeleton className={styles.loadingFormTitle} />
        <Skeleton className={styles.loadingFormDescription} />
        <Skeleton className={styles.loadingField} />
        <Skeleton className={styles.loadingField} />
      </div>
    </div>
  </section>
);

export const AccommodationEditScreen: React.FC<
  AccommodationEditScreenProps
> = ({ state, actions }) => {
  const { currentStep, isSaving, canProceedToNext } = state;
  const {
    isStepCompleted,
    isStepClickable,
    onSaveAndExit,
    onNext,
    onBack,
    onStepClick,
    onPublishSubmit,
  } = actions;
  const isRecoveryRequired = state.recoveryState !== "none";
  const isDraftInteractionLocked = isSaving || isRecoveryRequired;
  const isSaveExitLocked =
    isSaving || state.recoveryState === "protected-command";
  const stepRegionRef = React.useRef<HTMLDivElement>(null);
  const previousStepRef = React.useRef(currentStep);

  React.useEffect(() => {
    if (previousStepRef.current === currentStep) return;
    previousStepRef.current = currentStep;
    stepRegionRef.current?.focus();
  }, [currentStep]);

  if (state.detailState.status === "invalid-resource") {
    return (
      <div className={styles.stateShell}>
        <TerminalErrorState
          title="숙소 정보를 확인할 수 없어요"
          description="요청한 숙소가 존재하는지 확인해 주세요."
          action={
            <Button type="button" onClick={actions.onExitDetailError}>
              호스트 화면으로 돌아가기
            </Button>
          }
        />
      </div>
    );
  }

  if (state.detailState.status === "denied") {
    return (
      <div className={styles.stateShell}>
        <TerminalErrorState
          title="이 숙소를 수정할 권한이 없어요"
          description="호스트 계정과 숙소 소유권을 확인해 주세요."
          action={
            <Button type="button" onClick={actions.onExitDetailError}>
              호스트 화면으로 돌아가기
            </Button>
          }
        />
      </div>
    );
  }

  if (state.detailState.status === "retryable-load-error") {
    return (
      <div className={styles.stateShell}>
        <RetryableErrorState
          title="숙소 정보를 불러오지 못했어요"
          description="다시 시도하거나 호스트 화면으로 돌아가 주세요."
          action={
            <>
              <Button type="button" onClick={actions.onRetryDetail}>
                다시 시도
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={actions.onExitDetailError}
              >
                호스트 화면으로 돌아가기
              </Button>
            </>
          }
        />
      </div>
    );
  }

  if (state.detailState.status === "loading" || !state.isEditorReady) {
    return <EditorLoading />;
  }

  return (
    <>
      <div className={styles.container}>
        <EditWizardActionBar
          isSaving={isSaveExitLocked}
          onSaveAndExit={onSaveAndExit}
        />

        <div className={styles.content}>
          <EditWizardSidebar
            currentStep={currentStep}
            isInteractionDisabled={isDraftInteractionLocked}
            isStepCompleted={isStepCompleted}
            isStepClickable={isStepClickable}
            onStepClick={onStepClick}
          />

          <section
            className={styles.mainContent}
            aria-label="숙소 등록 편집 영역"
          >
            <form
              onSubmit={currentStep === 5 ? onPublishSubmit : undefined}
              className={styles.form}
              aria-label="숙소 등록 편집 양식"
              aria-busy={isSaving}
            >
              <fieldset
                className={styles.formFieldset}
                disabled={isDraftInteractionLocked}
              >
                <div
                  ref={stepRegionRef}
                  className={styles.stepPanel}
                  role="region"
                  aria-label={`${currentStep}단계 편집 내용`}
                  tabIndex={-1}
                >
                  <EditStepContent state={state} actions={actions} />
                </div>

                <EditWizardNavigation
                  currentStep={currentStep}
                  isSaving={isDraftInteractionLocked}
                  canProceedToNext={canProceedToNext}
                  onBack={onBack}
                  onNext={onNext}
                />
              </fieldset>
            </form>
          </section>
        </div>
      </div>

      <EditWizardDialogs state={state} actions={actions} />
    </>
  );
};
