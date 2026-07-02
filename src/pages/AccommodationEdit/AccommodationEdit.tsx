import React, { useCallback, useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { accommodationApi } from "../../api";
import { useApiError } from "../../hooks/useApiError";
import { ErrorToast } from "../../components/ErrorToast";
import { useAuth } from "../../hooks/useAuth";
import {
  DEFAULT_ACCOMMODATION_TYPE_OPTIONS,
  DEFAULT_AMENITY_OPTIONS,
} from "../../utils/codes";
import {
  AccommodationEditStep,
  useAccommodationEditForm,
} from "../../features/accommodations/edit/hooks/useAccommodationEditForm";
import { useAccommodationEditImages } from "../../features/accommodations/edit/hooks/useAccommodationEditImages";
import { useAccommodationEditSave } from "../../features/accommodations/edit/hooks/useAccommodationEditSave";
import { useDaumPostcode } from "../../features/accommodations/edit/hooks/useDaumPostcode";
import { AccommodationEditAddressInfo } from "../../features/accommodations/edit/lib/daumAddressMapper";
import { parseTime } from "../../features/accommodations/edit/lib/time";
import { LocationStep } from "./components/LocationStep";
import { PhotosStep } from "./components/PhotosStep";
import styles from "./AccommodationEdit.module.css";

type Step = AccommodationEditStep;

// 숙소 유형 정보
const ACCOMMODATION_TYPES = DEFAULT_ACCOMMODATION_TYPE_OPTIONS;

// 편의시설 정보
const AMENITY_TYPES = DEFAULT_AMENITY_OPTIONS;

const STEPS = [
  { number: 1, title: "위치", description: "숙소 위치를 설정하세요" },
  { number: 2, title: "숙소 사진", description: "숙소 사진을 등록하세요" },
  { number: 3, title: "숙소 정보", description: "기본 정보를 입력하세요" },
  { number: 4, title: "체크인/체크아웃", description: "체크인/체크아웃 시간을 설정하세요" },
  { number: 5, title: "숙소 등록", description: "숙소를 등록하세요" },
];

// 시간 선택 컴포넌트
interface TimePickerProps {
  hour: number;
  minute: number;
  period: "AM" | "PM";
  onChange: (hour: number, minute: number, period: "AM" | "PM") => void;
  onClose: () => void;
}

const TimePicker: React.FC<TimePickerProps> = ({ hour, minute, period, onChange, onClose }) => {
  const [localHour, setLocalHour] = useState(hour);
  const [localMinute, setLocalMinute] = useState(minute);
  const [localPeriod, setLocalPeriod] = useState<"AM" | "PM">(period);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalHour(hour);
    setLocalMinute(minute);
    setLocalPeriod(period);
  }, [hour, minute, period]);

  // 선택된 항목으로 스크롤
  useEffect(() => {
    if (hourListRef.current) {
      const selectedButton = hourListRef.current.querySelector(`.${styles.timePickerOptionSelected}`) as HTMLElement;
      if (selectedButton) {
        selectedButton.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [localHour]);

  useEffect(() => {
    if (minuteListRef.current) {
      const selectedButton = minuteListRef.current.querySelector(`.${styles.timePickerOptionSelected}`) as HTMLElement;
      if (selectedButton) {
        selectedButton.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [localMinute]);

  const handleHourChange = (value: number) => {
    if (value >= 1 && value <= 12) {
      setLocalHour(value);
      onChange(value, localMinute, localPeriod);
    }
  };

  const handleMinuteChange = (value: number) => {
    if (value >= 0 && value <= 59) {
      setLocalMinute(value);
      onChange(localHour, value, localPeriod);
    }
  };

  const handlePeriodChange = (newPeriod: "AM" | "PM") => {
    setLocalPeriod(newPeriod);
    onChange(localHour, localMinute, newPeriod);
  };

  // 키보드 입력 처리
  const handleKeyDown = (e: React.KeyboardEvent, type: "hour" | "minute") => {
    if (e.key.match(/[0-9]/)) {
      const digit = parseInt(e.key, 10);
      if (type === "hour") {
        // 1-9는 바로 선택, 0은 10, 1-2는 10-12로 처리
        if (digit >= 1 && digit <= 9) {
          handleHourChange(digit);
        } else if (digit === 0) {
          handleHourChange(10);
        }
      } else {
        // 분: 0-5는 0, 5, 10, 15, 20, 25...로 매핑
        if (digit >= 0 && digit <= 5) {
          handleMinuteChange(digit * 5);
        }
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      if (type === "hour") {
        const newHour = e.key === "ArrowUp" ? (localHour >= 12 ? 1 : localHour + 1) : (localHour <= 1 ? 12 : localHour - 1);
        handleHourChange(newHour);
      } else {
        const currentIndex = minutes.findIndex((m) => m === localMinute);
        const newIndex = e.key === "ArrowUp" 
          ? (currentIndex >= minutes.length - 1 ? 0 : currentIndex + 1)
          : (currentIndex <= 0 ? minutes.length - 1 : currentIndex - 1);
        handleMinuteChange(minutes[newIndex]);
      }
    }
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i).filter((m) => m % 5 === 0);

  return (
    <div 
      className={styles.timePickerDropdown} 
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // 포커스된 열에 따라 키보드 입력 처리
        const target = e.target as HTMLElement;
        if (target.closest(`.${styles.timePickerColumn}:nth-child(2)`)) {
          handleKeyDown(e, "hour");
        } else if (target.closest(`.${styles.timePickerColumn}:nth-child(3)`)) {
          handleKeyDown(e, "minute");
        }
      }}
      tabIndex={0}
    >
      <div className={styles.timePickerContent}>
        <div className={styles.timePickerColumn}>
          <div className={styles.timePickerHeader}>오전/오후</div>
          <div className={styles.timePickerList}>
            <button
              type="button"
              className={`${styles.timePickerOption} ${localPeriod === "AM" ? styles.timePickerOptionSelected : ""}`}
              onClick={() => handlePeriodChange("AM")}
            >
              오전
            </button>
            <button
              type="button"
              className={`${styles.timePickerOption} ${localPeriod === "PM" ? styles.timePickerOptionSelected : ""}`}
              onClick={() => handlePeriodChange("PM")}
            >
              오후
            </button>
          </div>
        </div>
        <div className={styles.timePickerColumn}>
          <div className={styles.timePickerHeader}>시간</div>
          <div className={styles.timePickerList} ref={hourListRef}>
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                className={`${styles.timePickerOption} ${localHour === h ? styles.timePickerOptionSelected : ""}`}
                onClick={() => handleHourChange(h)}
              >
                {String(h).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.timePickerColumn}>
          <div className={styles.timePickerHeader}>분</div>
          <div className={styles.timePickerList} ref={minuteListRef}>
            {minutes.map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.timePickerOption} ${localMinute === m ? styles.timePickerOptionSelected : ""}`}
                onClick={() => handleMinuteChange(m)}
              >
                {String(m).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const AccommodationEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
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
    navigate("/profile?mode=host");
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

  // 모달 외부 클릭 시 시간 선택기 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (openTimePicker && !target.closest(`.${styles.timeInputContainer}`)) {
        setOpenTimePicker(null);
      }
    };
    if (openTimePicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openTimePicker]);

  useEffect(() => {
    if (isAuthLoading) return;
    
    if (!isAuthenticated) {
      navigate("/");
      return;
    }

    // 수정 모드일 때 기존 데이터 불러오기
    // "호스팅하기"로 새로 생성된 초안인 경우 API 호출하지 않음
    if (id && !isNewDraft) {
      const fetchAccommodation = async () => {
        try {
          const data = await accommodationApi.getHostAccommodationDetail(Number(id));
          loadAccommodation(data);
          loadImages(data.images || []);
        } catch (err) {
          handleError(err);
        }
      };

      fetchAccommodation();
    }
  }, [
    id,
    isAuthenticated,
    isAuthLoading,
    isNewDraft,
    navigate,
    handleError,
    loadAccommodation,
    loadImages,
  ]);

  // 숙소 유형별 아이콘 반환
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "ENTIRE_PLACE":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        );
      case "PRIVATE_ROOM":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        );
      case "SHARED_ROOM":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        );
      case "HOTEL_ROOM":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="3" y1="16" x2="21" y2="16" />
          </svg>
        );
      case "HOSTEL":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="3" y1="16" x2="21" y2="16" />
            <line x1="9" y1="4" x2="9" y2="20" />
            <line x1="15" y1="4" x2="15" y2="20" />
          </svg>
        );
      case "VILLA":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 21l9-9 9 9" />
            <path d="M3 12h18" />
            <path d="M12 3v18" />
          </svg>
        );
      case "GUESTHOUSE":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
            <circle cx="12" cy="8" r="2" />
          </svg>
        );
      case "BNB":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <circle cx="8" cy="7" r="1" />
            <circle cx="16" cy="7" r="1" />
          </svg>
        );
      case "RESORT":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
            <path d="M6 12h12" />
          </svg>
        );
      case "APARTMENT":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="3" y1="16" x2="21" y2="16" />
            <line x1="9" y1="4" x2="9" y2="20" />
            <line x1="15" y1="4" x2="15" y2="20" />
          </svg>
        );
      case "HOUSE":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        );
      case "TENT":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 21l9-9 9 9" />
            <path d="M3 12h18" />
          </svg>
        );
      case "BOAT":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 18h18l-2-8H5l-2 8z" />
            <path d="M3 18l2-4h14l2 4" />
            <circle cx="7" cy="18" r="1" />
            <circle cx="17" cy="18" r="1" />
          </svg>
        );
      case "TREEHOUSE":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2v20" />
            <path d="M12 2l-4 4h8l-4-4z" />
            <path d="M8 6l-2 2h12l-2-2" />
            <rect x="6" y="8" width="12" height="8" rx="1" />
          </svg>
        );
      case "CAMPER_VAN":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="8" width="18" height="10" rx="2" />
            <path d="M3 12h18" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="18" r="2" />
            <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
          </svg>
        );
      case "CASTLE":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="8" width="18" height="12" rx="1" />
            <path d="M3 8l3-3h12l3 3" />
            <line x1="9" y1="8" x2="9" y2="20" />
            <line x1="15" y1="8" x2="15" y2="20" />
            <path d="M3 8l3 3-3 3" />
            <path d="M21 8l-3 3 3 3" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        );
    }
  };

  // 편의시설별 아이콘 반환
  const getAmenityIcon = (type: string) => {
    switch (type) {
      case "WIFI":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        );
      case "AIR_CONDITIONER":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <circle cx="8" cy="6" r="1" />
            <circle cx="16" cy="6" r="1" />
          </svg>
        );
      case "HEATING":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        );
      case "KITCHEN":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <circle cx="15" cy="15" r="2" />
          </svg>
        );
      case "WASHER":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        );
      case "DRYER":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        );
      case "PARKING":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 8h10M7 12h10M7 16h6" />
          </svg>
        );
      case "TV":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="7" width="20" height="12" rx="2" />
            <path d="M17 2l-5 5-5-5" />
          </svg>
        );
      case "HAIR_DRYER":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 12h-6M12 6v12" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        );
      case "IRON":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 12h18M12 3v18" />
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        );
      case "SHAMPOO":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="8" y="2" width="8" height="20" rx="2" />
            <path d="M8 6h8M8 10h8" />
          </svg>
        );
      case "BED_LINENS":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="8" width="18" height="12" rx="2" />
            <path d="M3 12h18M3 16h18" />
          </svg>
        );
      case "EXTRA_PILLOWS":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="6" width="16" height="12" rx="2" />
            <path d="M8 10h8M8 14h8" />
          </svg>
        );
      case "CRIB":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M3 12h18" />
          </svg>
        );
      case "HIGH_CHAIR":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="6" y="4" width="12" height="16" rx="2" />
            <path d="M6 8h12M6 12h12" />
            <path d="M9 20v-4M15 20v-4" />
          </svg>
        );
      case "DISHWASHER":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="12" cy="12" r="3" />
            <path d="M3 8h18M3 16h18" />
          </svg>
        );
      case "COFFEE_MACHINE":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M8 8h8M8 12h8" />
            <circle cx="12" cy="16" r="2" />
          </svg>
        );
      case "MICROWAVE":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18M3 16h18" />
            <circle cx="12" cy="13" r="2" />
          </svg>
        );
      case "REFRIGERATOR":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <path d="M4 8h16M4 14h16" />
            <circle cx="8" cy="11" r="1" />
          </svg>
        );
      case "ELEVATOR":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M5 8h14M5 16h14" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        );
      case "POOL":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 12h18M3 16h18M3 8h18" />
            <circle cx="6" cy="12" r="2" />
            <circle cx="18" cy="12" r="2" />
          </svg>
        );
      case "HOT_TUB":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        );
      case "GYM":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M12 3v18M3 12h18" />
            <circle cx="8" cy="8" r="1" />
            <circle cx="16" cy="16" r="1" />
          </svg>
        );
      case "SMOKE_ALARM":
      case "CARBON_MONOXIDE_ALARM":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        );
      case "FIRE_EXTINGUISHER":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="8" y="2" width="8" height="18" rx="2" />
            <path d="M8 6h8M8 10h8" />
            <circle cx="12" cy="16" r="2" />
          </svg>
        );
      case "PETS_ALLOWED":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="3" />
            <circle cx="15" cy="9" r="3" />
            <path d="M9 12v6M15 12v6" />
            <path d="M6 15h12" />
          </svg>
        );
      case "OUTDOOR_SPACE":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 12h18M12 3v18" />
            <circle cx="6" cy="6" r="2" />
            <circle cx="18" cy="18" r="2" />
            <circle cx="18" cy="6" r="2" />
            <circle cx="6" cy="18" r="2" />
          </svg>
        );
      case "BBQ_GRILL":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M3 10h18M3 14h18" />
            <circle cx="8" cy="12" r="1" />
            <circle cx="16" cy="12" r="1" />
          </svg>
        );
      case "BALCONY":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="8" width="18" height="12" rx="2" />
            <path d="M3 12h18M3 16h18" />
            <path d="M6 20v-4M18 20v-4" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 3v18" />
          </svg>
        );
    }
  };

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
    if (currentStep === 2 && id) {
      const filesToUpload = getPendingFiles();
      
      if (filesToUpload.length > 0) {
        setIsSaving(true);
        setUploadProgress(0);
        clearError();

        try {
          const response = await accommodationApi.uploadImages(
            Number(id),
            filesToUpload,
            (progress) => {
              setUploadProgress(progress);
            }
          );
          
          applyUploadedImages(response.uploaded_images);
          setUploadProgress(100);
        } catch (err) {
          handleError(err);
          setIsSaving(false);
          setUploadProgress(0);
          return;
        } finally {
          setIsSaving(false);
          // 진행률을 잠시 유지한 후 초기화
          setTimeout(() => {
            setUploadProgress(0);
          }, 500);
        }
      }
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

  if (isAuthLoading) {
    return (
      <MainLayout>
        <div className={styles.loading}>로딩 중...</div>
      </MainLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

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
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>숙소 정보를 알려주세요</h2>
            <p className={styles.stepDescription}>숙소의 기본 정보를 입력해주세요.</p>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                숙소 이름 <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className={styles.input}
                placeholder="예: 편안한 아파트"
                required
                maxLength={50}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                숙소 설명 <span className={styles.required}>*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                className={styles.textarea}
                placeholder="숙소에 대한 자세한 설명을 입력해주세요."
                required
                maxLength={5000}
                rows={8}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                숙소 유형 <span className={styles.required}>*</span>
              </label>
              <button
                type="button"
                className={styles.typeSelectButton}
                onClick={() => setIsTypeModalOpen(true)}
              >
                {ACCOMMODATION_TYPES.find((t) => t.value === formData.type)?.label || "숙소 유형 선택"}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                기본 가격 (원) <span className={styles.required}>*</span>
              </label>
              <input
                type="number"
                value={formData.basePrice}
                onChange={(e) => handleInputChange("basePrice", e.target.value)}
                className={`${styles.input} ${styles.priceInput}`}
                placeholder="50000"
                required
                min={5000}
              />
              <p className={styles.helperText}>1박 기준 가격입니다.</p>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>수용 인원</h3>
              <div className={styles.formGroup}>
                <div className={styles.quantityRow}>
                  <label className={styles.quantityLabel}>
                    게스트 <span className={styles.required}>*</span>
                  </label>
                  <div className={styles.quantitySelector}>
                    <button
                      type="button"
                      className={styles.quantityButton}
                      onClick={() => {
                        const current = Number(formData.occupancyPolicyInfo.maxOccupancy) || 1;
                        if (current > 1) {
                          handleNestedChange("occupancyPolicyInfo", "maxOccupancy", String(current - 1));
                        }
                      }}
                      disabled={Number(formData.occupancyPolicyInfo.maxOccupancy) <= 1}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <span className={styles.quantityValue}>
                      {formData.occupancyPolicyInfo.maxOccupancy || "1"}
                    </span>
                    <button
                      type="button"
                      className={styles.quantityButton}
                      onClick={() => {
                        const current = Number(formData.occupancyPolicyInfo.maxOccupancy) || 1;
                        handleNestedChange("occupancyPolicyInfo", "maxOccupancy", String(current + 1));
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className={styles.helperText}>최대 수용 가능한 게스트 수입니다.</p>
              </div>

              <div className={styles.formGroup}>
                <div className={styles.checkboxRow}>
                  <label className={styles.checkboxTextLabel}>유아</label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.occupancyPolicyInfo.infantOccupancy}
                      onChange={(e) => handleNestedChange("occupancyPolicyInfo", "infantOccupancy", e.target.checked)}
                      className={styles.checkbox}
                    />
                  </label>
                </div>
                <p className={styles.helperText}>유아 수용 가능 여부입니다.</p>
              </div>

              <div className={styles.formGroup}>
                <div className={styles.checkboxRow}>
                  <label className={styles.checkboxTextLabel}>반려동물</label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.occupancyPolicyInfo.petOccupancy}
                      onChange={(e) => handleNestedChange("occupancyPolicyInfo", "petOccupancy", e.target.checked)}
                      className={styles.checkbox}
                    />
                  </label>
                </div>
                <p className={styles.helperText}>반려동물 수용 가능 여부입니다.</p>
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>편의시설</h3>
              {formData.amenityInfos.length > 0 && (
                <div className={styles.selectedAmenitiesList}>
                  {formData.amenityInfos.map((amenity, index) => (
                    <div key={`${amenity.name}-${index}`} className={styles.selectedAmenityItem}>
                      <span className={styles.selectedAmenityName}>
                        {AMENITY_TYPES.find((a) => a.value === amenity.name)?.label || amenity.name}
                      </span>
                      <div className={styles.amenityCountSelector}>
                        <button
                          type="button"
                          className={styles.amenityCountButton}
                          onClick={() => {
                            const newAmenities = [...formData.amenityInfos];
                            if (amenity.count > 0) {
                              newAmenities[index] = { ...amenity, count: amenity.count - 1 };
                              if (newAmenities[index].count === 0) {
                                newAmenities.splice(index, 1);
                                setSelectedAmenities((prev) => {
                                  const newSet = new Set(prev);
                                  newSet.delete(amenity.name);
                                  return newSet;
                                });
                              }
                              setFormData((prev) => ({ ...prev, amenityInfos: newAmenities }));
                            }
                          }}
                          disabled={amenity.count <= 0}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </button>
                        <span className={styles.amenityCountValue}>{amenity.count}</span>
                        <button
                          type="button"
                          className={styles.amenityCountButton}
                          onClick={() => {
                            const newAmenities = [...formData.amenityInfos];
                            newAmenities[index] = { ...amenity, count: amenity.count + 1 };
                            setFormData((prev) => ({ ...prev, amenityInfos: newAmenities }));
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </button>
                      </div>
                      <button
                        type="button"
                        className={styles.amenityRemoveButton}
                        onClick={() => {
                          const newAmenities = formData.amenityInfos.filter((_, i) => i !== index);
                          setFormData((prev) => ({ ...prev, amenityInfos: newAmenities }));
                          setSelectedAmenities((prev) => {
                            const newSet = new Set(prev);
                            newSet.delete(amenity.name);
                            return newSet;
                          });
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className={styles.addAmenityButton}
                onClick={() => {
                  // 모달 열 때 현재 선택된 편의시설 상태 동기화
                  const currentSet = new Set(formData.amenityInfos.map((a) => a.name));
                  setSelectedAmenities(currentSet);
                  setIsAmenityModalOpen(true);
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                편의시설 추가
              </button>
            </div>
          </div>
        );

      case 4:
        const checkInParsed = parseTime(formData.checkInTime);
        const checkOutParsed = parseTime(formData.checkOutTime);

        return (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>체크인/체크아웃 시간을 설정하세요</h2>
            <p className={styles.stepDescription}>게스트가 체크인하고 체크아웃할 수 있는 시간을 설정해주세요.</p>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  체크인 시간 <span className={styles.required}>*</span>
                </label>
                <div className={styles.timeInputContainer}>
                  <button
                    type="button"
                    className={styles.timeInputButton}
                    onClick={() => setOpenTimePicker(openTimePicker === "checkIn" ? null : "checkIn")}
                  >
                    <span className={styles.timeDisplay}>
                      {checkInParsed.period === "AM" ? "오전" : "오후"} {String(checkInParsed.hour).padStart(2, "0")}:{String(checkInParsed.minute).padStart(2, "0")}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </button>
                  {openTimePicker === "checkIn" && (
                    <TimePicker
                      hour={checkInParsed.hour}
                      minute={checkInParsed.minute}
                      period={checkInParsed.period}
                      onChange={(h, m, p) => handleTimeChange("checkIn", h, m, p)}
                      onClose={() => setOpenTimePicker(null)}
                    />
                  )}
                </div>
                <p className={styles.helperText}>게스트가 체크인할 수 있는 시간입니다.</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  체크아웃 시간 <span className={styles.required}>*</span>
                </label>
                <div className={styles.timeInputContainer}>
                  <button
                    type="button"
                    className={styles.timeInputButton}
                    onClick={() => setOpenTimePicker(openTimePicker === "checkOut" ? null : "checkOut")}
                  >
                    <span className={styles.timeDisplay}>
                      {checkOutParsed.period === "AM" ? "오전" : "오후"} {String(checkOutParsed.hour).padStart(2, "0")}:{String(checkOutParsed.minute).padStart(2, "0")}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </button>
                  {openTimePicker === "checkOut" && (
                    <TimePicker
                      hour={checkOutParsed.hour}
                      minute={checkOutParsed.minute}
                      period={checkOutParsed.period}
                      onChange={(h, m, p) => handleTimeChange("checkOut", h, m, p)}
                      onClose={() => setOpenTimePicker(null)}
                    />
                  )}
                </div>
                <p className={styles.helperText}>게스트가 체크아웃해야 하는 시간입니다.</p>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>숙소를 등록하세요</h2>
            <p className={styles.stepDescription}>모든 정보를 확인하고 숙소를 등록하세요.</p>
            <p className={styles.helperText}>저장하기 버튼을 클릭하면 숙소가 공개됩니다.</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <MainLayout>
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
        <div className={styles.typeModalOverlay} onClick={closeDetailAddressConfirm}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmModalContent}>
              <h2 className={styles.confirmModalTitle}>상세 주소 확인</h2>
              <p className={styles.confirmModalMessage}>
                상세주소를 입력하지 않으셨습니다. 이대로 진행하시겠습니까?
              </p>
              <div className={styles.confirmModalButtons}>
                <button
                  type="button"
                  className={styles.confirmModalButtonCancel}
                  onClick={closeDetailAddressConfirm}
                >
                  취소
                </button>
                <button
                  type="button"
                  className={styles.confirmModalButtonConfirm}
                  onClick={confirmDetailAddress}
                >
                  진행하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 숙소 유형 선택 모달 */}
      {isTypeModalOpen && (
        <div className={styles.typeModalOverlay} onClick={() => setIsTypeModalOpen(false)}>
          <div className={styles.typeModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.typeModalHeader}>
              <h2 className={styles.typeModalTitle}>다음 중 숙소를 가장 잘 설명하는 것은 무엇인가요?</h2>
              <button
                type="button"
                className={styles.typeModalClose}
                onClick={() => setIsTypeModalOpen(false)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.typeModalGrid}>
              {ACCOMMODATION_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`${styles.typeOption} ${formData.type === type.value ? styles.typeOptionSelected : ""}`}
                  onClick={() => {
                    handleInputChange("type", type.value);
                    setIsTypeModalOpen(false);
                  }}
                >
                  <div className={styles.typeOptionIcon}>
                    {getTypeIcon(type.value)}
                  </div>
                  <span className={styles.typeOptionLabel}>{type.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 편의시설 선택 모달 */}
      {isAmenityModalOpen && (
        <div className={styles.typeModalOverlay} onClick={() => setIsAmenityModalOpen(false)}>
          <div className={styles.typeModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.typeModalHeader}>
              <h2 className={styles.typeModalTitle}>편의시설을 선택하세요</h2>
              <button
                type="button"
                className={styles.typeModalClose}
                onClick={() => setIsAmenityModalOpen(false)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.typeModalGrid}>
              {AMENITY_TYPES.map((amenity) => {
                const isSelected = selectedAmenities.has(amenity.value);
                const currentAmenity = formData.amenityInfos.find((a) => a.name === amenity.value);
                const count = currentAmenity?.count || 0;
                
                return (
                  <div key={amenity.value} className={styles.amenityOptionContainer}>
                    <button
                      type="button"
                      className={`${styles.typeOption} ${isSelected ? styles.typeOptionSelected : ""}`}
                      onClick={() => {
                        if (isSelected) {
                          // 선택 해제
                          setSelectedAmenities((prev) => {
                            const newSet = new Set(prev);
                            newSet.delete(amenity.value);
                            return newSet;
                          });
                          setFormData((prev) => ({
                            ...prev,
                            amenityInfos: prev.amenityInfos.filter((a) => a.name !== amenity.value),
                          }));
                        } else {
                          // 선택 추가
                          setSelectedAmenities((prev) => new Set(prev).add(amenity.value));
                          setFormData((prev) => ({
                            ...prev,
                            amenityInfos: [...prev.amenityInfos, { name: amenity.value, count: 1 }],
                          }));
                        }
                      }}
                    >
                      <div className={styles.typeOptionIcon}>
                        {getAmenityIcon(amenity.value)}
                      </div>
                      {isSelected && (
                        <div className={styles.amenityCountControl}>
                          <button
                            type="button"
                            className={styles.amenityCountButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (count > 1) {
                                setFormData((prev) => ({
                                  ...prev,
                                  amenityInfos: prev.amenityInfos.map((a) =>
                                    a.name === amenity.value ? { ...a, count: count - 1 } : a
                                  ),
                                }));
                              }
                            }}
                            disabled={count <= 1}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </button>
                          <span className={styles.amenityCountValue}>{count}</span>
                          <button
                            type="button"
                            className={styles.amenityCountButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData((prev) => ({
                                ...prev,
                                amenityInfos: prev.amenityInfos.map((a) =>
                                  a.name === amenity.value ? { ...a, count: count + 1 } : a
                                ),
                              }));
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </button>
                        </div>
                      )}
                      <span className={styles.typeOptionLabel}>{amenity.label}</span>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className={styles.amenityModalFooter}>
              <button
                type="button"
                className={styles.amenityModalDoneButton}
                onClick={() => setIsAmenityModalOpen(false)}
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default AccommodationEdit;
