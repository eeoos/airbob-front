import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { accommodationApi } from "../../api";
import { useApiError } from "../../hooks/useApiError";
import { ErrorToast } from "../../components/ErrorToast";
import { useAuth } from "../../hooks/useAuth";
import { getImageUrl } from "../../utils/image";
import styles from "./AccommodationEdit.module.css";

// Daum 우편번호 서비스 타입 정의
declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: {
          zonecode: string;
          address: string;
          addressEnglish: string;
          addressType: string;
          bname: string;
          buildingName: string;
          apartment: string;
          sido: string;
          sigungu: string;
          sigunguCode: string;
          bcode: string;
          roadname: string;
          roadnameCode: string;
          jibunAddress: string;
          roadAddress?: string;
        }) => void;
        width?: string;
        height?: string;
        maxSuggestItems?: number;
      }) => {
        open: () => void;
        embed: (element: HTMLElement) => void;
      };
    };
  }
}

type Step = 1 | 2 | 3 | 4 | 5;

// 숙소 유형 정보
const ACCOMMODATION_TYPES = [
  { value: "ENTIRE_PLACE", label: "전체 숙소" },
  { value: "PRIVATE_ROOM", label: "개인실" },
  { value: "SHARED_ROOM", label: "다인실" },
  { value: "HOTEL_ROOM", label: "호텔 객실" },
  { value: "HOSTEL", label: "호스텔" },
  { value: "VILLA", label: "빌라" },
  { value: "GUESTHOUSE", label: "게스트하우스" },
  { value: "BNB", label: "B&B" },
  { value: "RESORT", label: "리조트" },
  { value: "APARTMENT", label: "아파트" },
  { value: "HOUSE", label: "일반 주택" },
  { value: "TENT", label: "텐트" },
  { value: "BOAT", label: "보트" },
  { value: "TREEHOUSE", label: "트리하우스" },
  { value: "CAMPER_VAN", label: "캠핑카" },
  { value: "CASTLE", label: "성" },
] as const;

// 편의시설 정보
const AMENITY_TYPES = [
  { value: "WIFI", label: "무선 인터넷" },
  { value: "AIR_CONDITIONER", label: "에어컨" },
  { value: "HEATING", label: "난방" },
  { value: "KITCHEN", label: "주방" },
  { value: "WASHER", label: "세탁기" },
  { value: "DRYER", label: "건조기" },
  { value: "PARKING", label: "주차 공간" },
  { value: "TV", label: "TV" },
  { value: "HAIR_DRYER", label: "헤어드라이어" },
  { value: "IRON", label: "다리미" },
  { value: "SHAMPOO", label: "샴푸" },
  { value: "BED_LINENS", label: "침구류" },
  { value: "EXTRA_PILLOWS", label: "추가 베개 및 담요" },
  { value: "CRIB", label: "아기 침대" },
  { value: "HIGH_CHAIR", label: "아기 식탁의자" },
  { value: "DISHWASHER", label: "식기세척기" },
  { value: "COFFEE_MACHINE", label: "커피 머신" },
  { value: "MICROWAVE", label: "전자레인지" },
  { value: "REFRIGERATOR", label: "냉장고" },
  { value: "ELEVATOR", label: "엘리베이터" },
  { value: "POOL", label: "수영장" },
  { value: "HOT_TUB", label: "온수 욕조" },
  { value: "GYM", label: "헬스장" },
  { value: "SMOKE_ALARM", label: "화재 경보기" },
  { value: "CARBON_MONOXIDE_ALARM", label: "일산화탄소 경보기" },
  { value: "FIRE_EXTINGUISHER", label: "소화기" },
  { value: "PETS_ALLOWED", label: "반려동물 허용" },
  { value: "OUTDOOR_SPACE", label: "야외 공간" },
  { value: "BBQ_GRILL", label: "바베큐 그릴" },
  { value: "BALCONY", label: "발코니" },
] as const;

// 이미지 아이템 타입: 업로드된 이미지(id 있음) 또는 업로드 대기 이미지(file 있음)
interface ImageItem {
  id?: number; // 업로드된 이미지 ID
  url: string; // 이미지 URL
  file?: File; // 아직 업로드되지 않은 파일
  preview?: string; // 미리보기 URL (file이 있을 때)
  tempId?: string; // 임시 고유 ID (드래그 앤 드롭용)
}

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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const imageItemsRef = React.useRef<ImageItem[]>([]);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isAmenityModalOpen, setIsAmenityModalOpen] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(new Set());
  const [openTimePicker, setOpenTimePicker] = useState<"checkIn" | "checkOut" | null>(null);
  const [initialFormData, setInitialFormData] = useState<any>(null);
  const [initialImageItems, setInitialImageItems] = useState<ImageItem[]>([]);
  
  // imageItems가 변경될 때마다 ref 업데이트
  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

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

  // 폼 상태
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    basePrice: "",
    type: "APARTMENT",
    checkInTime: "15:00",
    checkOutTime: "11:00",
    addressInfo: {
      postalCode: "",
      city: "",
      state: "",
      country: "대한민국",
      detail: "",
      district: "",
      street: "",
    },
    occupancyPolicyInfo: {
      maxOccupancy: "1",
      infantOccupancy: false,
      petOccupancy: false,
    },
    amenityInfos: [] as Array<{ name: string; count: number }>,
  });

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
          
          // 폼 데이터 설정
          const loadedFormData = {
            name: data.name || "",
            description: data.description || "",
            basePrice: String(data.base_price || ""),
            type: data.type || "APARTMENT",
            checkInTime: data.check_in_time || "15:00",
            checkOutTime: data.check_out_time || "11:00",
            addressInfo: {
              postalCode: data.address?.postal_code || "",
              city: data.address?.city || "",
              state: data.address?.state || "",
              country: data.address?.country || "대한민국",
              detail: data.address?.detail || "",
              district: data.address?.district || "",
              street: data.address?.street || "",
            },
            occupancyPolicyInfo: {
              maxOccupancy: String(data.policy?.max_occupancy || "1"),
              infantOccupancy: (data.policy?.infant_occupancy || 0) > 0,
              petOccupancy: (data.policy?.pet_occupancy || 0) > 0,
            },
            amenityInfos: data.amenities?.map((a) => ({ name: a.type, count: a.count })) || [],
          };
          
          setFormData(loadedFormData);
          
          // 초기 데이터 저장 (변경사항 추적용)
          setInitialFormData(JSON.parse(JSON.stringify(loadedFormData)));

          // 편의시설 선택 상태 초기화
          const amenitySet = new Set(data.amenities?.map((a) => a.type) || []);
          setSelectedAmenities(amenitySet);

          // 기존 이미지 설정
          const loadedImageItems = data.images && data.images.length > 0
            ? data.images.map((image, index) => ({ 
                id: image.id,
                url: image.image_url,
                tempId: `existing-${index}-${Date.now()}`,
              }))
            : [];
          setImageItems(loadedImageItems);
          
          // 초기 이미지 저장
          setInitialImageItems(JSON.parse(JSON.stringify(loadedImageItems)));
        } catch (err) {
          handleError(err);
        }
      };

      fetchAccommodation();
    }
    // 새로 생성된 초안인 경우 기본값만 유지 (이미 초기화되어 있음)
  }, [id, isAuthenticated, navigate, handleError]);

  // 컴포넌트 언마운트 시 미리보기 URL 정리 (한 번만 실행)
  useEffect(() => {
    return () => {
      // unmount 시점에는 imageItemsRef.current를 사용하여 최신 값 참조
      imageItemsRef.current.forEach((item) => {
        if (item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, []); // 빈 배열: 컴포넌트 unmount 시에만 실행

  const getUpdateData = (isDraft: boolean = false) => {
    const data: any = {};
    
    // 초안 모드일 때는 입력된 필드만 포함
    if (isDraft) {
      if (formData.name && formData.name.trim()) {
        data.name = formData.name;
      }
      if (formData.description && formData.description.trim()) {
        data.description = formData.description;
      }
      if (formData.basePrice && Number(formData.basePrice) > 0) {
        data.base_price = Number(formData.basePrice);
      }
      if (formData.type) {
        data.type = formData.type;
      }
      if (formData.checkInTime) {
        data.check_in_time = formData.checkInTime;
      }
      if (formData.checkOutTime) {
        data.check_out_time = formData.checkOutTime;
      }
      
      // 주소 정보: 하나라도 입력된 경우에만 포함
      const hasAddressData = 
        formData.addressInfo.postalCode ||
        formData.addressInfo.city ||
        formData.addressInfo.state ||
        formData.addressInfo.district ||
        formData.addressInfo.street ||
        formData.addressInfo.detail;
      
      if (hasAddressData) {
        data.address_info = {};
        if (formData.addressInfo.postalCode) {
          data.address_info.postal_code = formData.addressInfo.postalCode;
        }
        if (formData.addressInfo.city) {
          data.address_info.city = formData.addressInfo.city;
        }
        if (formData.addressInfo.state) {
          data.address_info.state = formData.addressInfo.state;
        }
        if (formData.addressInfo.district) {
          data.address_info.district = formData.addressInfo.district;
        }
        if (formData.addressInfo.street) {
          data.address_info.street = formData.addressInfo.street;
        }
        if (formData.addressInfo.detail) {
          data.address_info.detail = formData.addressInfo.detail;
        }
        if (formData.addressInfo.country) {
          data.address_info.country = formData.addressInfo.country;
        }
      }
      
      // 수용 인원 정보: 입력된 경우에만 포함
      if (formData.occupancyPolicyInfo.maxOccupancy && Number(formData.occupancyPolicyInfo.maxOccupancy) > 0) {
        data.occupancy_policy_info = {
          max_occupancy: Number(formData.occupancyPolicyInfo.maxOccupancy),
          infant_occupancy: formData.occupancyPolicyInfo.infantOccupancy ? 1 : 0,
          pet_occupancy: formData.occupancyPolicyInfo.petOccupancy ? 1 : 0,
        };
      }
      
      if (formData.amenityInfos.length > 0) {
        data.amenity_infos = formData.amenityInfos;
      }
    } else {
      // 수정 모드일 때는 변경된 필드만 포함
      if (!initialFormData) {
        // 초기 데이터가 없으면 모든 필드 포함 (안전장치)
        data.name = formData.name;
        data.description = formData.description;
        data.base_price = Number(formData.basePrice);
        data.type = formData.type;
        data.check_in_time = formData.checkInTime;
        data.check_out_time = formData.checkOutTime;
        
        if (formData.addressInfo) {
          data.address_info = {};
          if (formData.addressInfo.postalCode && formData.addressInfo.postalCode.trim()) {
            data.address_info.postal_code = formData.addressInfo.postalCode.trim();
          }
          if (formData.addressInfo.city && formData.addressInfo.city.trim()) {
            data.address_info.city = formData.addressInfo.city.trim();
          }
          if (formData.addressInfo.state && formData.addressInfo.state.trim()) {
            data.address_info.state = formData.addressInfo.state.trim();
          }
          if (formData.addressInfo.country && formData.addressInfo.country.trim()) {
            data.address_info.country = formData.addressInfo.country.trim();
          }
          if (formData.addressInfo.detail && formData.addressInfo.detail.trim()) {
            data.address_info.detail = formData.addressInfo.detail.trim();
          }
          if (formData.addressInfo.district && formData.addressInfo.district.trim()) {
            data.address_info.district = formData.addressInfo.district.trim();
          }
          if (formData.addressInfo.street && formData.addressInfo.street.trim()) {
            data.address_info.street = formData.addressInfo.street.trim();
          }
        }
        
        data.occupancy_policy_info = {
          max_occupancy: Number(formData.occupancyPolicyInfo.maxOccupancy),
          infant_occupancy: formData.occupancyPolicyInfo.infantOccupancy ? 1 : 0,
          pet_occupancy: formData.occupancyPolicyInfo.petOccupancy ? 1 : 0,
        };
        data.amenity_infos = formData.amenityInfos;
      } else {
        // 초기 데이터와 비교해서 변경된 필드만 포함
        if (formData.name !== initialFormData.name) {
          data.name = formData.name;
        }
        if (formData.description !== initialFormData.description) {
          data.description = formData.description;
        }
        if (formData.basePrice !== initialFormData.basePrice) {
          data.base_price = Number(formData.basePrice);
        }
        if (formData.type !== initialFormData.type) {
          data.type = formData.type;
        }
        if (formData.checkInTime !== initialFormData.checkInTime) {
          data.check_in_time = formData.checkInTime;
        }
        if (formData.checkOutTime !== initialFormData.checkOutTime) {
          data.check_out_time = formData.checkOutTime;
        }
        
        // 주소 정보 비교
        const addressChanged = 
          formData.addressInfo.postalCode !== initialFormData.addressInfo.postalCode ||
          formData.addressInfo.city !== initialFormData.addressInfo.city ||
          formData.addressInfo.state !== initialFormData.addressInfo.state ||
          formData.addressInfo.country !== initialFormData.addressInfo.country ||
          formData.addressInfo.detail !== initialFormData.addressInfo.detail ||
          formData.addressInfo.district !== initialFormData.addressInfo.district ||
          formData.addressInfo.street !== initialFormData.addressInfo.street;
        
        if (addressChanged) {
          data.address_info = {};
          if (formData.addressInfo.postalCode && formData.addressInfo.postalCode.trim()) {
            data.address_info.postal_code = formData.addressInfo.postalCode.trim();
          }
          if (formData.addressInfo.city && formData.addressInfo.city.trim()) {
            data.address_info.city = formData.addressInfo.city.trim();
          }
          if (formData.addressInfo.state && formData.addressInfo.state.trim()) {
            data.address_info.state = formData.addressInfo.state.trim();
          }
          if (formData.addressInfo.country && formData.addressInfo.country.trim()) {
            data.address_info.country = formData.addressInfo.country.trim();
          }
          if (formData.addressInfo.detail && formData.addressInfo.detail.trim()) {
            data.address_info.detail = formData.addressInfo.detail.trim();
          }
          if (formData.addressInfo.district && formData.addressInfo.district.trim()) {
            data.address_info.district = formData.addressInfo.district.trim();
          }
          if (formData.addressInfo.street && formData.addressInfo.street.trim()) {
            data.address_info.street = formData.addressInfo.street.trim();
          }
        }
        
        // 수용 인원 정보 비교
        const occupancyChanged = 
          formData.occupancyPolicyInfo.maxOccupancy !== initialFormData.occupancyPolicyInfo.maxOccupancy ||
          formData.occupancyPolicyInfo.infantOccupancy !== initialFormData.occupancyPolicyInfo.infantOccupancy ||
          formData.occupancyPolicyInfo.petOccupancy !== initialFormData.occupancyPolicyInfo.petOccupancy;
        
        if (occupancyChanged) {
          data.occupancy_policy_info = {
            max_occupancy: Number(formData.occupancyPolicyInfo.maxOccupancy),
            infant_occupancy: formData.occupancyPolicyInfo.infantOccupancy ? 1 : 0,
            pet_occupancy: formData.occupancyPolicyInfo.petOccupancy ? 1 : 0,
          };
        }
        
        // 편의시설 비교
        const amenityChanged = JSON.stringify(formData.amenityInfos.sort((a: { name: string; count: number }, b: { name: string; count: number }) => a.name.localeCompare(b.name))) !== 
          JSON.stringify(initialFormData.amenityInfos.sort((a: { name: string; count: number }, b: { name: string; count: number }) => a.name.localeCompare(b.name)));
        
        if (amenityChanged) {
          data.amenity_infos = formData.amenityInfos;
        }
      }
    }
    
    return data;
  };

  const handleSaveAndExit = async () => {
    if (!id) return;

    setIsSaving(true);
    clearError();

    try {
      // 초안 모드일 때는 입력된 필드만 보내기
      const updateData = getUpdateData(isNewDraft);
      
      // 이미지 변경 확인
      const imageChanged = !isNewDraft && initialImageItems.length > 0 && 
        JSON.stringify(imageItems.map((i: ImageItem) => ({ id: i.id, url: i.url })).sort((a: { id?: number; url: string }, b: { id?: number; url: string }) => (a.id || 0) - (b.id || 0))) !== 
        JSON.stringify(initialImageItems.map((i: ImageItem) => ({ id: i.id, url: i.url })).sort((a: { id?: number; url: string }, b: { id?: number; url: string }) => (a.id || 0) - (b.id || 0)));
      
      // 변경사항이 없으면 요청 보내지 않음
      const hasChanges = Object.keys(updateData).length > 0 || imageChanged;
      
      if (!hasChanges) {
        // 변경사항이 없으면 바로 이동
        navigate("/profile?mode=host");
        setIsSaving(false);
        return;
      }
      
      console.log("저장 후 나가기 - 요청 데이터:", JSON.stringify(updateData, null, 2));
      console.log("저장 후 나가기 - 주소 정보:", updateData.address_info);
      await accommodationApi.update(Number(id), updateData);
      // 저장 성공 시 프로필 페이지의 호스트 모드로 이동
      navigate("/profile?mode=host");
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsSaving(true);
    clearError();

    try {
      // 먼저 현재 폼 데이터로 숙소 수정
      const updateData = getUpdateData();
      console.log("저장하기 - 요청 데이터:", JSON.stringify(updateData, null, 2));
      console.log("저장하기 - 주소 정보:", updateData.address_info);
      await accommodationApi.update(Number(id), updateData);
      // 그 다음 숙소 공개
      await accommodationApi.publish(Number(id));
      // 공개 성공 시 프로필 페이지의 호스트 모드로 이동
      navigate("/profile?mode=host");
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [parent]: {
        ...(prev[parent as keyof typeof prev] as any),
        [field]: value,
      },
    }));
  };

  // 시간을 12시간 형식으로 변환 (HH:mm -> {hour, minute, period})
  const parseTime = (time: string) => {
    const [hourStr, minuteStr] = time.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const period: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return { hour: displayHour, minute, period, originalHour: hour };
  };

  // 12시간 형식을 24시간 형식으로 변환
  const formatTime = (hour: number, minute: number, period: "AM" | "PM"): string => {
    let hour24 = hour;
    if (period === "PM" && hour !== 12) {
      hour24 = hour + 12;
    } else if (period === "AM" && hour === 12) {
      hour24 = 0;
    }
    return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  // 시간 업데이트
  const handleTimeChange = (type: "checkIn" | "checkOut", hour: number, minute: number, period: "AM" | "PM") => {
    const timeString = formatTime(hour, minute, period);
    handleInputChange(type === "checkIn" ? "checkInTime" : "checkOutTime", timeString);
  };

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

  const validateFiles = (files: File[]): File[] => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

    return files.filter((file) => {
      if (file.size > maxSize) {
        handleError(new Error(`${file.name} 파일 크기는 10MB를 초과할 수 없습니다.`));
        return false;
      }
      if (!imageTypes.includes(file.type)) {
        handleError(new Error(`${file.name}은(는) 지원하지 않는 이미지 형식입니다.`));
        return false;
      }
      return true;
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = validateFiles(files);
    if (validFiles.length === 0) {
      e.target.value = "";
      return;
    }

    // 새로운 이미지 아이템 추가
    const newItems: ImageItem[] = validFiles.map((file, idx) => ({
      file,
      url: "",
      preview: URL.createObjectURL(file),
      tempId: `temp-${Date.now()}-${Math.random()}-${idx}-${file.name}`,
    }));

    setImageItems((prev) => [...prev, ...newItems]);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const validFiles = validateFiles(files);
    if (validFiles.length === 0) return;

    const newItems: ImageItem[] = validFiles.map((file, idx) => ({
      file,
      url: "",
      preview: URL.createObjectURL(file),
      tempId: `temp-${Date.now()}-${Math.random()}-${idx}-${file.name}`,
    }));

    setImageItems((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageRemove = (index: number) => {
    const item = imageItems[index];
    
    // 미리보기 URL 해제
    if (item.preview) {
      URL.revokeObjectURL(item.preview);
    }

    // 업로드된 이미지인 경우 서버에서 삭제
    if (item.id && id) {
      accommodationApi.deleteImage(Number(id), item.id).catch(handleError);
    }

    setImageItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 드래그 앤 드롭으로 이미지 순서 변경
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    setDragOverIndex(null);
  };

  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex === null || draggedIndex === index) return;
    
    // 드래그 오버 인덱스만 업데이트 (실제 상태 변경은 하지 않음)
    // 이전 값과 다를 때만 업데이트하여 불필요한 리렌더링 방지
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentDraggedIndex = draggedIndex;
    const currentDragOverIndex = dragOverIndex;
    
    if (currentDraggedIndex !== null && currentDragOverIndex !== null && currentDraggedIndex !== currentDragOverIndex) {
      // 드래그가 끝날 때만 실제 상태 변경 (ref를 사용하여 최신 값 보장)
      setImageItems((prevItems) => {
        const items = prevItems.length > 0 ? prevItems : imageItemsRef.current;
        const newItems = [...items];
        // 드래그된 아이템을 그대로 참조 복사 (preview URL 유지)
        // spread operator로 얕은 복사만 하면 preview URL 참조가 유지됨
        const draggedItem = newItems[currentDraggedIndex];
        newItems.splice(currentDraggedIndex, 1);
        newItems.splice(currentDragOverIndex, 0, draggedItem);
        return newItems;
      });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleNext = async () => {
    // 2번 단계(숙소 사진)에서 다음으로 넘어갈 때 아직 업로드되지 않은 이미지 업로드
    if (currentStep === 2 && id) {
      const filesToUpload = imageItems.filter((item) => item.file && !item.id);
      
      if (filesToUpload.length > 0) {
        setIsSaving(true);
        setUploadProgress(0);
        clearError();

        try {
          const files = filesToUpload.map((item) => item.file!);
          const response = await accommodationApi.uploadImages(
            Number(id),
            files,
            (progress) => {
              setUploadProgress(progress);
            }
          );
          
          // 업로드된 이미지 정보로 업데이트
          setImageItems((prev) => {
            const updated = [...prev];
            let uploadIndex = 0;
            
            response.uploaded_images.forEach((uploaded) => {
              // file이 있지만 id가 없는 항목 찾기
              const index = updated.findIndex((item) => item.file && !item.id);
              if (index !== -1) {
                const item = updated[index];
                // 미리보기 URL 해제
                if (item.preview) {
                  URL.revokeObjectURL(item.preview);
                }
                updated[index] = {
                  id: uploaded.id,
                  url: uploaded.image_url,
                  tempId: item.tempId, // tempId 유지
                };
              }
            });
            
            return updated;
          });
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

  const handleAddressSearch = () => {
    if (!window.daum || !window.daum.Postcode) {
      alert("주소 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침해주세요.");
      return;
    }

    // 최종 한국 주소 매핑 로직
    const handleComplete = (data: {
      zonecode: string;
      address: string;
      addressEnglish: string;
      addressType: string;
      bname: string;
      buildingName: string;
      apartment: string;
      sido: string;
      sigungu: string;
      sigunguCode: string;
      bcode: string;
      roadname: string;
      roadnameCode: string;
      jibunAddress: string;
      roadAddress?: string;
    }) => {
      const fullSido = data.sido || "";
      const fullSigungu = data.sigungu || "";

      let state = fullSido;
      let city = "";
      let district = "";

      // 광역시/특별시 리스트
      const metropolitanList = ["서울", "부산", "대구", "인천", "광주", "대전", "울산"];

      // 1) "전주시 덕진구"처럼 시 + 구 구성
      if (fullSigungu.includes(" ")) {
        const parts = fullSigungu.split(" ").filter(Boolean);
        city = parts[0];
        district = parts.slice(1).join(" ");
      }
      // 2) 특별/광역시인 경우 (서울특별시, 서울 등 변형 포함)
      else if (
        fullSigungu !== "" &&
        metropolitanList.some((metro) => fullSido.startsWith(metro))
      ) {
        city = fullSido;       // ex: "서울특별시", "부산광역시"
        district = fullSigungu;
      }
      // 3) 일반 시/군 단독 ("구리시", "고창군", "서귀포시")
      else if (fullSigungu !== "") {
        city = fullSigungu;
        district = "";
      }
      // 4) 세종·기타 sigungu 없음
      else {
        city = fullSido;
        district = "";
      }

      // street 정제
      let street = data.roadAddress || data.address || "";
      street = street
        .replace(fullSido, "")
        .replace(fullSigungu, "")
        .trim();

      const addressInfo = {
        postalCode: data.zonecode || "",
        country: "대한민국",
        state,
        city,
        district,
        street,
        detail: ""
      };

      console.log("Refined Address:", addressInfo);

      setFormData((prev) => ({
        ...prev,
        addressInfo
      }));
    };

    new window.daum.Postcode({
      oncomplete: handleComplete,
      width: "100%",
      height: "100%",
    }).open();
  };

  const isStepCompleted = (step: Step): boolean => {
    switch (step) {
      case 1:
        // 위치: 우편번호, 상세 주소 완료
        return !!(
          formData.addressInfo.postalCode &&
          formData.addressInfo.postalCode.trim() !== "" &&
          formData.addressInfo.detail &&
          formData.addressInfo.detail.trim() !== ""
        );
      case 2:
        // 숙소 사진은 최소 1장 이상 필요
        return imageItems.length >= 1;
      case 3:
        // 숙소 정보: 이름, 설명, 가격, 유형, 수용 인원 완료
        return !!(
          formData.name &&
          formData.description &&
          formData.basePrice &&
          formData.type &&
          formData.occupancyPolicyInfo.maxOccupancy
        );
      case 4:
        // 초안 모드인 경우: 기본값이 있어도 이전 단계를 완료하지 않으면 완료로 간주하지 않음
        if (isNewDraft) {
          // 이전 단계들이 모두 완료되어야 체크인/체크아웃이 완료된 것으로 간주
          const prevStepsCompleted = isStepCompleted(1) && isStepCompleted(2) && isStepCompleted(3);
          return prevStepsCompleted && !!(formData.checkInTime && formData.checkOutTime);
        }
        return !!(formData.checkInTime && formData.checkOutTime);
      case 5:
        // 숙소 등록은 모든 단계가 완료되어야 함
        return isStepCompleted(1) && isStepCompleted(2) && isStepCompleted(3) && isStepCompleted(4);
      default:
        return false;
    }
  };

  const canProceedToNext = (): boolean => {
    return isStepCompleted(currentStep);
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
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>숙소 위치를 알려주세요</h2>
            <p className={styles.stepDescription}>숙소의 정확한 위치를 입력해주세요.</p>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                주소 검색 <span className={styles.required}>*</span>
              </label>
              <div className={styles.addressSearchContainer}>
                <input
                  type="text"
                  value={
                    formData.addressInfo.street
                      ? `[${formData.addressInfo.postalCode}] ${formData.addressInfo.street}`.trim()
                      : ""
                  }
                  className={styles.input}
                  placeholder="주소를 검색하세요"
                  readOnly
                />
                <button
                  type="button"
                  className={styles.addressSearchButton}
                  onClick={handleAddressSearch}
                >
                  주소 검색
                </button>
              </div>
              <p className={styles.helperText}>주소 검색 버튼을 클릭하여 주소를 검색하세요.</p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                우편번호 <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={formData.addressInfo.postalCode}
                onChange={(e) => handleNestedChange("addressInfo", "postalCode", e.target.value)}
                className={styles.input}
                placeholder="12345"
                required
                maxLength={12}
                readOnly
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                상세 주소 <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={formData.addressInfo.detail}
                onChange={(e) => handleNestedChange("addressInfo", "detail", e.target.value)}
                className={styles.input}
                placeholder="101호 또는 건물명, 동/호수 등을 입력하세요"
                required
              />
              <p className={styles.helperText}>상세 주소(동/호수 등)를 입력해주세요.</p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                국가 <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={formData.addressInfo.country}
                onChange={(e) => handleNestedChange("addressInfo", "country", e.target.value)}
                className={styles.input}
                required
                readOnly
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>숙소 사진을 등록하세요</h2>
            <p className={styles.stepDescription}>
              숙소 등록을 시작하려면 사진 1장을 제출하셔야 합니다. 나중에 추가하거나 변경하실 수 있습니다.
            </p>

            {/* 업로드 진행률 바 */}
            {isSaving && uploadProgress > 0 && (
              <div className={styles.uploadProgressContainer}>
                <div className={styles.uploadProgressBar}>
                  <div
                    className={styles.uploadProgressFill}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className={styles.uploadProgressText}>{uploadProgress}% 업로드 중...</p>
              </div>
            )}

            {/* 사진이 없을 때: 1번 이미지 스타일 - 큰 업로드 박스 */}
            {imageItems.length === 0 ? (
              <div
                className={styles.imageUploadBox}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  type="file"
                  id="imageInputEmpty"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  className={styles.imageInput}
                />
                <div className={styles.imageUploadBoxLabel}>
                  <div className={styles.cameraIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                  <button
                    type="button"
                    className={styles.addPhotoButton}
                    onClick={() => document.getElementById("imageInputEmpty")?.click()}
                  >
                    사진 추가하기
                  </button>
                </div>
              </div>
            ) : (
              /* 사진이 있을 때: 커버 사진(전체 너비) + 2x2 그리드 */
              <div className={styles.uploadedImagesSection}>
                <div className={styles.uploadedImagesHeader}>
                  <div>
                    <p className={styles.uploadedImagesTitle}>
                      1개 이상의 사진을 선택하세요.
                    </p>
                    <p className={styles.uploadedImagesSubtitle}>드래그하여 순서 변경</p>
                  </div>
                  <button
                    type="button"
                    className={styles.addMoreButton}
                    onClick={() => document.getElementById("imageInput")?.click()}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>

                <input
                  type="file"
                  id="imageInput"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  className={styles.imageInput}
                />

                {/* 커버 사진 (최상단, 전체 너비) */}
                {imageItems.length > 0 && (() => {
                  const coverItem = imageItems[0];
                  const coverImageUrl = coverItem.preview || getImageUrl(coverItem.url);
                  const coverKey = coverItem.id || coverItem.tempId || `cover-${coverItem.preview || coverItem.url}`;
                  
                  return (
                    <div className={styles.coverPhotoContainer}>
                      <div
                        key={coverKey}
                        className={`${styles.uploadedImageItem} ${draggedIndex === 0 ? styles.dragging : ""} ${dragOverIndex === 0 ? styles.dragOver : ""}`}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleDragStart(0);
                        }}
                        onDragOver={(e) => handleDragOverItem(e, 0)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className={styles.coverPhotoLabel}>커버 사진</div>
                        <img
                          key={`img-${coverKey}`}
                          src={coverImageUrl}
                          alt="커버 사진"
                          className={styles.uploadedImage}
                        />
                        <button
                          type="button"
                          className={styles.imageMenuButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageRemove(0);
                          }}
                          aria-label="이미지 삭제"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 2열 그리드 (커버 사진 제외한 나머지) - 동적으로 늘어남 */}
                <div className={styles.thumbnailGrid}>
                  {/* 커버 사진 제외한 나머지 이미지들 */}
                  {imageItems.slice(1).map((item, index) => {
                    const itemIndex = index + 1; // 실제 인덱스 (커버 사진 다음부터)
                    const imageUrl = item.preview || getImageUrl(item.url);
                    // key는 인덱스 기반이 아닌 고유 ID만 사용 (드래그 후에도 안정적)
                    const uniqueKey = item.id || item.tempId || `item-${item.preview || item.url}`;
                    return (
                      <div
                        key={uniqueKey}
                        className={`${styles.uploadedImageItem} ${draggedIndex === itemIndex ? styles.dragging : ""} ${dragOverIndex === itemIndex ? styles.dragOver : ""}`}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleDragStart(itemIndex);
                        }}
                        onDragOver={(e) => handleDragOverItem(e, itemIndex)}
                        onDragEnd={handleDragEnd}
                      >
                        <img 
                          key={`img-${uniqueKey}`}
                          src={imageUrl} 
                          alt={`이미지 ${itemIndex + 1}`} 
                          className={styles.uploadedImage}
                        />
                        <button
                          type="button"
                          className={styles.imageMenuButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageRemove(itemIndex);
                          }}
                          aria-label="이미지 삭제"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  
                  {/* 마지막 슬롯은 항상 "추가" 버튼 */}
                  <div
                    className={styles.addImageSlot}
                    onClick={() => document.getElementById("imageInput")?.click()}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span>추가</span>
                  </div>
                </div>
              </div>
            )}
          </div>
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
