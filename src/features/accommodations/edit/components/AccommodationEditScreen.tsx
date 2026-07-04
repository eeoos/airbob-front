import React, { useEffect } from "react";
import { ErrorToast } from "../../../../components/ErrorToast";
import { AccommodationEditStep } from "../hooks/useAccommodationEditForm";
import { AccommodationEditFormData } from "../lib/accommodationEditMapper";
import { AccommodationEditImageItem } from "../lib/imageItems";
import { AccommodationTypeModal } from "./AccommodationTypeModal";
import { AmenityModal } from "./AmenityModal";
import { DetailAddressConfirmModal } from "./DetailAddressConfirmModal";
import { InfoStep } from "./InfoStep";
import { LocationStep } from "./LocationStep";
import { PhotosStep } from "./PhotosStep";
import { PublishStep } from "./PublishStep";
import { TimeStep } from "./TimeStep";
import styles from "./EditWizardLayout.module.css";
import timeStyles from "./TimeStep.module.css";

type Step = AccommodationEditStep;

type NestedFormFields = {
  addressInfo: AccommodationEditFormData["addressInfo"];
  occupancyPolicyInfo: AccommodationEditFormData["occupancyPolicyInfo"];
};

export interface AccommodationEditScreenState {
  currentStep: Step;
  isSaving: boolean;
  uploadProgress: number;
  formData: AccommodationEditFormData;
  selectedAmenities: Set<string>;
  imageItems: AccommodationEditImageItem[];
  draggedIndex: number | null;
  dragOverIndex: number | null;
  openTimePicker: "checkIn" | "checkOut" | null;
  isTypeModalOpen: boolean;
  isAmenityModalOpen: boolean;
  showDetailAddressConfirm: boolean;
  error: string | null;
  canProceedToNext: boolean;
}

export interface AccommodationEditScreenActions {
  isStepCompleted: (step: Step) => boolean;
  isStepClickable: (step: Step) => boolean;
  setFormData: React.Dispatch<React.SetStateAction<AccommodationEditFormData>>;
  setSelectedAmenities: React.Dispatch<React.SetStateAction<Set<string>>>;
  setOpenTimePicker: React.Dispatch<
    React.SetStateAction<"checkIn" | "checkOut" | null>
  >;
  onAddressSearch: () => void;
  onDetailChange: (value: string) => void;
  onImageSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onImageRemove: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOverItem: (event: React.DragEvent, index: number) => void;
  onDragEnd: (event: React.DragEvent) => void;
  onInputChange: <K extends keyof AccommodationEditFormData>(
    field: K,
    value: AccommodationEditFormData[K]
  ) => void;
  onNestedChange: <
    P extends keyof NestedFormFields,
    K extends keyof NestedFormFields[P]
  >(
    parent: P,
    field: K,
    value: NestedFormFields[P][K]
  ) => void;
  onTimeChange: (
    type: "checkIn" | "checkOut",
    hour: number,
    minute: number,
    period: "AM" | "PM"
  ) => void;
  onOpenTypeModal: () => void;
  onCloseTypeModal: () => void;
  onOpenAmenityModal: () => void;
  onCloseAmenityModal: () => void;
  onSaveAndExit: () => void;
  onNext: () => void | Promise<void>;
  onBack: () => void;
  onStepClick: (stepNumber: number) => void;
  onPublishSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCloseDetailAddressConfirm: () => void;
  onConfirmDetailAddress: () => void;
  onClearError: () => void;
}

export interface AccommodationEditScreenProps {
  state: AccommodationEditScreenState;
  actions: AccommodationEditScreenActions;
}

const STEPS: Array<{
  number: Step;
  title: string;
  description: string;
}> = [
  { number: 1, title: "위치", description: "숙소 위치를 설정하세요" },
  { number: 2, title: "숙소 사진", description: "숙소 사진을 등록하세요" },
  { number: 3, title: "숙소 정보", description: "기본 정보를 입력하세요" },
  { number: 4, title: "체크인/체크아웃", description: "체크인/체크아웃 시간을 설정하세요" },
  { number: 5, title: "숙소 등록", description: "숙소를 등록하세요" },
];

export const AccommodationEditScreen: React.FC<AccommodationEditScreenProps> = ({
  state,
  actions,
}) => {
  const {
    currentStep,
    isSaving,
    uploadProgress,
    formData,
    selectedAmenities,
    imageItems,
    draggedIndex,
    dragOverIndex,
    openTimePicker,
    isTypeModalOpen,
    isAmenityModalOpen,
    showDetailAddressConfirm,
    error,
    canProceedToNext,
  } = state;
  const {
    isStepCompleted,
    isStepClickable,
    setFormData,
    setSelectedAmenities,
    setOpenTimePicker,
    onAddressSearch,
    onDetailChange,
    onImageSelect,
    onDrop,
    onDragOver,
    onImageRemove,
    onDragStart,
    onDragOverItem,
    onDragEnd,
    onInputChange,
    onNestedChange,
    onTimeChange,
    onOpenTypeModal,
    onCloseTypeModal,
    onOpenAmenityModal,
    onCloseAmenityModal,
    onSaveAndExit,
    onNext,
    onBack,
    onStepClick,
    onPublishSubmit,
    onCloseDetailAddressConfirm,
    onConfirmDetailAddress,
    onClearError,
  } = actions;
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (openTimePicker && !target.closest(`.${timeStyles.timeInputContainer}`)) {
        setOpenTimePicker(null);
      }
    };

    if (openTimePicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openTimePicker, setOpenTimePicker]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <LocationStep
            addressInfo={formData.addressInfo}
            onAddressSearch={onAddressSearch}
            onDetailChange={onDetailChange}
          />
        );

      case 2:
        return (
          <PhotosStep
            imageItems={imageItems}
            isSaving={isSaving}
            uploadProgress={uploadProgress}
            draggedIndex={draggedIndex}
            dragOverIndex={dragOverIndex}
            onImageSelect={onImageSelect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onImageRemove={onImageRemove}
            onDragStart={onDragStart}
            onDragOverItem={onDragOverItem}
            onDragEnd={onDragEnd}
          />
        );

      case 3:
        return (
          <InfoStep
            formData={formData}
            onInputChange={onInputChange}
            onNestedChange={onNestedChange}
            setFormData={setFormData}
            setSelectedAmenities={setSelectedAmenities}
            onOpenTypeModal={onOpenTypeModal}
            onOpenAmenityModal={onOpenAmenityModal}
          />
        );

      case 4:
        return (
          <TimeStep
            checkInTime={formData.checkInTime}
            checkOutTime={formData.checkOutTime}
            openTimePicker={openTimePicker}
            setOpenTimePicker={setOpenTimePicker}
            onTimeChange={onTimeChange}
          />
        );

      case 5:
        return <PublishStep />;

      default:
        return null;
    }
  };

  return (
    <>
      <div className={styles.container}>
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

        <div className={styles.content}>
          <div className={styles.sidebar}>
            {STEPS.map((step) => (
              <div
                key={step.number}
                className={`${styles.stepItem} ${
                  currentStep === step.number ? styles.active : ""
                } ${
                  isStepCompleted(step.number) &&
                  currentStep !== step.number &&
                  step.number !== 5
                    ? styles.completed
                    : ""
                } ${isStepClickable(step.number) ? styles.clickable : ""}`}
                onClick={() => onStepClick(step.number)}
              >
                <div className={styles.stepNumber}>{step.number}</div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepItemTitle}>{step.title}</div>
                  <div className={styles.stepItemDescription}>
                    {step.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.mainContent}>
            <form
              onSubmit={currentStep === 5 ? onPublishSubmit : undefined}
              className={styles.form}
            >
              {renderStepContent()}

              <div className={styles.buttonGroup}>
                {currentStep > 1 && (
                  <button
                    type="button"
                    className={styles.backButton}
                    onClick={onBack}
                  >
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
            </form>
          </div>
        </div>

        {error && (
          <div className={styles.toastContainer}>
            <ErrorToast message={error} onClose={onClearError} />
          </div>
        )}
      </div>

      {showDetailAddressConfirm && (
        <DetailAddressConfirmModal
          onClose={onCloseDetailAddressConfirm}
          onConfirm={onConfirmDetailAddress}
        />
      )}

      {isTypeModalOpen && (
        <AccommodationTypeModal
          selectedType={formData.type}
          onSelect={(type) => onInputChange("type", type)}
          onClose={onCloseTypeModal}
        />
      )}

      {isAmenityModalOpen && (
        <AmenityModal
          amenityInfos={formData.amenityInfos}
          selectedAmenities={selectedAmenities}
          setFormData={setFormData}
          setSelectedAmenities={setSelectedAmenities}
          onClose={onCloseAmenityModal}
        />
      )}
    </>
  );
};
