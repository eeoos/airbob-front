import React, { useCallback, useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useApiError } from "../../hooks/useApiError";
import { ErrorToast } from "../../components/ErrorToast";
import {
  AccommodationEditStep,
  useAccommodationEditForm,
} from "../../features/accommodations/edit/hooks/useAccommodationEditForm";
import { useAccommodationEditDetail } from "../../features/accommodations/edit/hooks/useAccommodationEditDetail";
import { useAccommodationEditImageUpload } from "../../features/accommodations/edit/hooks/useAccommodationEditImageUpload";
import { useAccommodationEditImages } from "../../features/accommodations/edit/hooks/useAccommodationEditImages";
import { useAccommodationEditSave } from "../../features/accommodations/edit/hooks/useAccommodationEditSave";
import { useDaumPostcode } from "../../features/accommodations/edit/hooks/useDaumPostcode";
import { AccommodationEditAddressInfo } from "../../features/accommodations/edit/lib/daumAddressMapper";
import { AccommodationTypeModal } from "./components/AccommodationTypeModal";
import { AmenityModal } from "./components/AmenityModal";
import { DetailAddressConfirmModal } from "./components/DetailAddressConfirmModal";
import { InfoStep } from "./components/InfoStep";
import { LocationStep } from "./components/LocationStep";
import { PhotosStep } from "./components/PhotosStep";
import { PublishStep } from "./components/PublishStep";
import { TimeStep } from "./components/TimeStep";
import { routeTo } from "../../routes/paths";
import styles from "./components/EditWizardLayout.module.css";
import timeStyles from "./components/TimeStep.module.css";

type Step = AccommodationEditStep;

const STEPS = [
  { number: 1, title: "위치", description: "숙소 위치를 설정하세요" },
  { number: 2, title: "숙소 사진", description: "숙소 사진을 등록하세요" },
  { number: 3, title: "숙소 정보", description: "기본 정보를 입력하세요" },
  { number: 4, title: "체크인/체크아웃", description: "체크인/체크아웃 시간을 설정하세요" },
  { number: 5, title: "숙소 등록", description: "숙소를 등록하세요" },
];

const AccommodationEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { error, handleError, clearError } = useApiError();
  const isNewDraft = searchParams.get("mode") === "create";
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isAmenityModalOpen, setIsAmenityModalOpen] = useState(false);

  const {
    formData,
    setFormData,
    initialFormData,
    selectedAmenities,
    setSelectedAmenities,
    openTimePicker,
    setOpenTimePicker,
    loadAccommodation,
    handleInputChange,
    handleNestedChange,
    handleTimeChange,
    isStepCompleted: isFormStepCompleted,
    canProceedToNext: canProceedToNextStep,
  } = useAccommodationEditForm();

  const {
    imageItems,
    initialImageItems,
    draggedIndex,
    dragOverIndex,
    loadImages,
    handleImageSelect,
    handleDrop,
    handleDragOver,
    handleImageRemove,
    handleDragStart,
    handleDragOverItem,
    handleDragEnd,
    applyUploadedImages,
    getPendingFiles,
  } = useAccommodationEditImages({
    accommodationId: id,
    onError: handleError,
  });

  const navigateToHostProfile = useCallback(() => {
    navigate(routeTo.profile({ mode: "host" }));
  }, [navigate]);

  const {
    showDetailAddressConfirm,
    requestDetailAddressConfirm,
    closeDetailAddressConfirm,
    confirmDetailAddress,
    handleSaveAndExit,
    handlePublish,
    saveStepData,
  } = useAccommodationEditSave({
    accommodationId: id,
    currentStep,
    isNewDraft,
    formData,
    initialFormData,
    imageItems,
    initialImageItems,
    clearError,
    handleError,
    setIsSaving,
    navigateToHostProfile,
  });

  const handleAddressSelected = useCallback(
    (addressInfo: AccommodationEditAddressInfo) => {
      setFormData((prev) => ({
        ...prev,
        addressInfo,
      }));
    },
    [setFormData]
  );

  const { openAddressSearch: handleAddressSearch } = useDaumPostcode({
    onAddressSelected: handleAddressSelected,
  });

  useAccommodationEditDetail({
    accommodationId: id,
    isNewDraft,
    loadAccommodation,
    loadImages,
    handleError,
  });

  const { uploadPendingImages } = useAccommodationEditImageUpload({
    accommodationId: id,
    applyUploadedImages,
    clearError,
    getPendingFiles,
    handleError,
    setIsSaving,
    setUploadProgress,
  });

  // 모달 외부 클릭 시 시간 선택기 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (openTimePicker && !target.closest(`.${timeStyles.timeInputContainer}`)) {
        setOpenTimePicker(null);
      }
    };
    if (openTimePicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openTimePicker]);

  const isStepCompleted = (step: Step): boolean =>
    isFormStepCompleted(step, {
      imageCount: imageItems.length,
      isNewDraft,
    });

  const canProceedToNext = (): boolean =>
    canProceedToNextStep(currentStep, {
      imageCount: imageItems.length,
      isNewDraft,
    });

  const handleNext = async () => {
    // 1번 단계(위치 정보)에서 다음으로 넘어갈 때 상세 주소 확인
    if (currentStep === 1) {
      const hasDetailAddress = formData.addressInfo.detail && formData.addressInfo.detail.trim() !== "";
      if (!hasDetailAddress) {
        requestDetailAddressConfirm(() => {
          if (currentStep < 5) {
            setCurrentStep((prev) => (prev + 1) as Step);
          }
        });
        return;
      }
    }

    // 2번 단계(숙소 사진)에서 다음으로 넘어갈 때 아직 업로드되지 않은 이미지 업로드
    if (currentStep === 2) {
      const uploaded = await uploadPendingImages();
      if (!uploaded) return;
    }

    // 4단계(체크인/체크아웃)에서 다음 버튼을 누를 때 데이터 저장
    if (currentStep === 4 && id) {
      const saved = await saveStepData();
      if (!saved) return;
      setCurrentStep((prev) => (prev + 1) as Step);
      return;
    }

    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleStepClick = (stepNumber: number) => {
    const targetStep = stepNumber as Step;
    
    // 초안 모드인 경우: 이전 단계들을 모두 완료한 경우에만 이동 가능
    if (isNewDraft) {
      // 현재 단계 이전의 모든 단계가 완료되어야 함
      let canNavigate = true;
      for (let i = 1; i < targetStep; i++) {
        if (!isStepCompleted(i as Step)) {
          canNavigate = false;
          break;
        }
      }
      if (canNavigate) {
        setCurrentStep(targetStep);
      }
    } else {
      // 수정 모드인 경우:
      // 1. 완료된 단계는 자유롭게 이동 가능
      // 2. 현재 단계를 완료했으면 다음 단계로 이동 가능
      // 3. 이전 단계로는 항상 이동 가능 (완료 여부와 관계없이)
      const isCompleted = isStepCompleted(targetStep);
      const isCurrentCompleted = isStepCompleted(currentStep);
      const isNextStep = targetStep === currentStep + 1;
      const isPreviousStep = targetStep < currentStep;

      if (isCompleted || (isCurrentCompleted && isNextStep) || isPreviousStep) {
        setCurrentStep(targetStep);
      }
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <LocationStep
            addressInfo={formData.addressInfo}
            onAddressSearch={handleAddressSearch}
            onDetailChange={(value) =>
              handleNestedChange("addressInfo", "detail", value)
            }
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
            onImageSelect={handleImageSelect}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onImageRemove={handleImageRemove}
            onDragStart={handleDragStart}
            onDragOverItem={handleDragOverItem}
            onDragEnd={handleDragEnd}
          />
        );

      case 3:
        return (
          <InfoStep
            formData={formData}
            onInputChange={handleInputChange}
            onNestedChange={handleNestedChange}
            setFormData={setFormData}
            setSelectedAmenities={setSelectedAmenities}
            onOpenTypeModal={() => setIsTypeModalOpen(true)}
            onOpenAmenityModal={() => setIsAmenityModalOpen(true)}
          />
        );

      case 4:
        return (
          <TimeStep
            checkInTime={formData.checkInTime}
            checkOutTime={formData.checkOutTime}
            openTimePicker={openTimePicker}
            setOpenTimePicker={setOpenTimePicker}
            onTimeChange={handleTimeChange}
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
            onClick={handleSaveAndExit}
            disabled={isSaving}
          >
            저장 후 나가기
          </button>
        </div>

        <div className={styles.content}>
          {/* 왼쪽: 진행 단계 */}
          <div className={styles.sidebar}>
            {STEPS.map((step) => (
              <div
                key={step.number}
                className={`${styles.stepItem} ${currentStep === step.number ? styles.active : ""} ${
                  isStepCompleted(step.number as Step) &&
                  currentStep !== step.number &&
                  step.number !== 5
                    ? styles.completed
                    : ""
                } ${
                  isNewDraft
                    ? (() => {
                        // 초안 모드: 이전 단계들이 모두 완료된 경우에만 클릭 가능
                        let canClick = true;
                        for (let i = 1; i < step.number; i++) {
                          if (!isStepCompleted(i as Step)) {
                            canClick = false;
                            break;
                          }
                        }
                        return canClick ? styles.clickable : "";
                      })()
                    : (() => {
                        // 수정 모드: 완료된 단계, 다음 단계(현재 완료 시), 또는 이전 단계는 클릭 가능
                        const isCompleted = isStepCompleted(step.number as Step);
                        const isCurrentCompleted = isStepCompleted(currentStep);
                        const isNextStep = step.number === currentStep + 1;
                        const isPreviousStep = step.number < currentStep;
                        return (isCompleted || (isCurrentCompleted && isNextStep) || isPreviousStep)
                          ? styles.clickable
                          : "";
                      })()
                }`}
                onClick={() => handleStepClick(step.number)}
              >
                <div className={styles.stepNumber}>
                  {step.number}
                </div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepItemTitle}>{step.title}</div>
                  <div className={styles.stepItemDescription}>{step.description}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 오른쪽: 현재 단계 폼 */}
          <div className={styles.mainContent}>
            <form onSubmit={currentStep === 5 ? handlePublish : undefined} className={styles.form}>
              {renderStepContent()}

              <div className={styles.buttonGroup}>
                {currentStep > 1 && (
                  <button type="button" className={styles.backButton} onClick={handleBack}>
                    뒤로
                  </button>
                )}
                {currentStep < 5 ? (
                  <button
                    type="button"
                    className={styles.nextButton}
                    onClick={handleNext}
                    disabled={isSaving || !canProceedToNext()}
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
                    disabled={isSaving || !canProceedToNext()}
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
            <ErrorToast message={error} onClose={clearError} />
          </div>
        )}
      </div>

      {/* 상세 주소 확인 모달 */}
      {showDetailAddressConfirm && (
        <DetailAddressConfirmModal
          onClose={closeDetailAddressConfirm}
          onConfirm={confirmDetailAddress}
        />
      )}

      {/* 숙소 유형 선택 모달 */}
      {isTypeModalOpen && (
        <AccommodationTypeModal
          selectedType={formData.type}
          onSelect={(type) => handleInputChange("type", type)}
          onClose={() => setIsTypeModalOpen(false)}
        />
      )}

      {/* 편의시설 선택 모달 */}
      {isAmenityModalOpen && (
        <AmenityModal
          amenityInfos={formData.amenityInfos}
          selectedAmenities={selectedAmenities}
          setFormData={setFormData}
          setSelectedAmenities={setSelectedAmenities}
          onClose={() => setIsAmenityModalOpen(false)}
        />
      )}
    </>
  );
};

export default AccommodationEdit;
