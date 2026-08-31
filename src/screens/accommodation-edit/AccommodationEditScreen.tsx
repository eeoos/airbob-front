import React from "react";
import { Button, ErrorState, LoadingState } from "../../shared/ui";
import { EditStepContent } from "./components/EditStepContent";
import { EditWizardActionBar } from "./components/EditWizardActionBar";
import { EditWizardDialogs } from "./components/EditWizardDialogs";
import styles from "./components/EditWizardLayout.module.css";
import { EditWizardNavigation } from "./components/EditWizardNavigation";
import { EditWizardSidebar } from "./components/EditWizardSidebar";
import type { AccommodationEditScreenProps } from "./editorViewContract";

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

  if (state.detailState.status === "invalid-resource") {
    return (
      <ErrorState
        title="숙소 정보를 확인할 수 없어요"
        description="요청한 숙소가 존재하는지 확인해 주세요."
        action={
          <Button type="button" onClick={actions.onExitDetailError}>
            호스트 화면으로 돌아가기
          </Button>
        }
      />
    );
  }

  if (state.detailState.status === "denied") {
    return (
      <ErrorState
        title="이 숙소를 수정할 권한이 없어요"
        description="호스트 계정과 숙소 소유권을 확인해 주세요."
        action={
          <Button type="button" onClick={actions.onExitDetailError}>
            호스트 화면으로 돌아가기
          </Button>
        }
      />
    );
  }

  if (state.detailState.status === "retryable-load-error") {
    return (
      <ErrorState
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
    );
  }

  if (state.detailState.status === "loading" || !state.isEditorReady) {
    return <LoadingState title="숙소 정보를 불러오는 중..." />;
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

          <div className={styles.mainContent}>
            <form
              onSubmit={currentStep === 5 ? onPublishSubmit : undefined}
              className={styles.form}
            >
              <fieldset
                className={styles.formFieldset}
                disabled={isDraftInteractionLocked}
              >
                <EditStepContent state={state} actions={actions} />

                <EditWizardNavigation
                  currentStep={currentStep}
                  isSaving={isDraftInteractionLocked}
                  canProceedToNext={canProceedToNext}
                  onBack={onBack}
                  onNext={onNext}
                />
              </fieldset>
            </form>
          </div>
        </div>
      </div>

      <EditWizardDialogs state={state} actions={actions} />
    </>
  );
};
