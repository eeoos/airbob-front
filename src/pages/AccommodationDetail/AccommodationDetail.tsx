import React, { useEffect, useState, useMemo, useRef, useTransition, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { accommodationApi, recentlyViewedApi, reservationApi, reviewApi } from "../../api";
import { AccommodationDetail as AccommodationDetailType } from "../../types/accommodation";
import { ReviewInfo } from "../../types/review";
import { ReviewSortType } from "../../types/enums";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import { WishlistModal } from "../../components/WishlistModal";
import { AuthModal } from "../../components/AuthModal/AuthModal";
import { ReviewModal } from "../../components/ReviewModal/ReviewModal";
import DatePicker from "../../components/DatePicker/DatePicker";
import { getImageUrl } from "../../utils/image";
import { GOOGLE_MAPS_API_KEY } from "../../utils/constants";
import styles from "./AccommodationDetail.module.css";

// AccommodationType을 한글로 변환하는 함수
const getAccommodationTypeKorean = (type: string): string => {
  const typeMap: Record<string, string> = {
    ENTIRE_PLACE: "집 전체",
    PRIVATE_ROOM: "개인실",
    SHARED_ROOM: "다인실",
    HOSTEL: "호스텔",
  };
  return typeMap[type] || "숙소";
};

// AmenityType을 한글로 변환하는 함수
const getAmenityTypeKorean = (type: string): string => {
  const amenityMap: Record<string, string> = {
    WIFI: "무선 인터넷",
    AIR_CONDITIONER: "에어컨",
    HEATING: "난방",
    KITCHEN: "주방",
    WASHER: "세탁기",
    DRYER: "건조기",
    PARKING: "주차 공간",
    TV: "TV",
    HAIR_DRYER: "헤어드라이어",
    IRON: "다리미",
    SHAMPOO: "샴푸",
    BED_LINENS: "침구류",
    EXTRA_PILLOWS: "추가 베개 및 담요",
    CRIB: "아기 침대",
    HIGH_CHAIR: "아기 식탁의자",
    DISHWASHER: "식기세척기",
    COFFEE_MACHINE: "커피 머신",
    MICROWAVE: "전자레인지",
    REFRIGERATOR: "냉장고",
    ELEVATOR: "엘리베이터",
    POOL: "수영장",
    HOT_TUB: "온수 욕조",
    GYM: "헬스장",
    SMOKE_ALARM: "화재 경보기",
    CARBON_MONOXIDE_ALARM: "일산화탄소 경보기",
    FIRE_EXTINGUISHER: "소화기",
    PETS_ALLOWED: "반려동물 허용",
    OUTDOOR_SPACE: "야외 공간",
    BBQ_GRILL: "바베큐 그릴",
    BALCONY: "발코니",
    UNKNOWN: "알 수 없음",
  };
  return amenityMap[type] || type;
};

// AmenityType에 맞는 아이콘을 반환하는 함수
const getAmenityIcon = (type: string): React.ReactNode => {
  const iconStyle = { width: "24px", height: "24px", flexShrink: 0 };
  
  switch (type) {
    case "WIFI":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      );
    case "AIR_CONDITIONER":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M6 8h12" />
          <path d="M6 12h12" />
          <path d="M6 16h12" />
        </svg>
      );
    case "HEATING":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle}>
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case "KITCHEN":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M6 2v20M6 2h12M6 6h12M6 10h12M6 14h12" />
        </svg>
      );
    case "WASHER":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "DRYER":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <circle cx="12" cy="12" r="8" />
          <path d="M8 12h8" />
        </svg>
      );
    case "PARKING":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle}>
          <path d="M9 2h6v20H9z" />
          <path d="M9 2v6h6V2" />
        </svg>
      );
    case "TV":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <rect x="2" y="7" width="20" height="15" rx="2" />
          <path d="M17 2l-5 5-5-5" />
        </svg>
      );
    case "POOL":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M2 12c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2 2 6.477 2 12z" />
          <path d="M2 12h20" />
          <path d="M12 2v20" />
        </svg>
      );
    case "GYM":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M6.5 6.5h11v11h-11z" />
          <path d="M6.5 6.5l5.5 5.5M12 12l5.5 5.5" />
        </svg>
      );
    case "HAIR_DRYER":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M18 12h-8M10 8h6M10 16h6" />
          <circle cx="6" cy="12" r="2" />
        </svg>
      );
    case "IRON":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M3 12h18M3 6h18M3 18h18" />
          <path d="M6 3v18" />
        </svg>
      );
    case "SHAMPOO":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M12 2v20M12 2c-2 0-4 2-4 4v2c0 2 2 4 4 4s4-2 4-4V6c0-2-2-4-4-4z" />
        </svg>
      );
    case "BED_LINENS":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <rect x="3" y="7" width="18" height="12" rx="2" />
          <path d="M3 11h18M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "EXTRA_PILLOWS":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <rect x="3" y="7" width="18" height="12" rx="2" />
          <path d="M3 11h18" />
        </svg>
      );
    case "CRIB":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18M9 6v12M15 6v12" />
        </svg>
      );
    case "HIGH_CHAIR":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M6 4h12v16H6z" />
          <path d="M6 8h12M6 12h12" />
        </svg>
      );
    case "DISHWASHER":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "COFFEE_MACHINE":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      );
    case "MICROWAVE":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M6 8h12M6 12h8" />
        </svg>
      );
    case "REFRIGERATOR":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M12 4v16" />
        </svg>
      );
    case "ELEVATOR":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h8" />
        </svg>
      );
    case "HOT_TUB":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
    case "SMOKE_ALARM":
    case "CARBON_MONOXIDE_ALARM":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6M12 16h.01" />
        </svg>
      );
    case "FIRE_EXTINGUISHER":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M12 2v4M12 6c-2 0-4 2-4 4v8c0 2 2 4 4 4s4-2 4-4v-8c0-2-2-4-4-4z" />
        </svg>
      );
    case "PETS_ALLOWED":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M12 2c-2.5 0-4.5 2-4.5 4.5 0 1.5 1 2.5 2 3.5v8c0 1.5 1.5 3 3.5 3s3.5-1.5 3.5-3v-8c1-1 2-2 2-3.5C18.5 4 16.5 2 14 2h-2z" />
          <circle cx="9" cy="6.5" r="1" />
          <circle cx="15" cy="6.5" r="1" />
        </svg>
      );
    case "OUTDOOR_SPACE":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
    case "BBQ_GRILL":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M6 10h12M6 14h12" />
        </svg>
      );
    case "BALCONY":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <rect x="2" y="8" width="20" height="14" rx="2" />
          <path d="M2 12h20" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6M12 16h.01" />
        </svg>
      );
  }
};

const AccommodationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { error, handleError, clearError } = useApiError();
  const { isAuthenticated } = useAuth();
  const [accommodation, setAccommodation] = useState<AccommodationDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [mobileSlideIndex, setMobileSlideIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false);
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isGuestPickerOpen, setIsGuestPickerOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const dateSectionRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  
  // 리뷰 관련 상태
  const [reviews, setReviews] = useState<ReviewInfo[]>([]);
  const [allReviews, setAllReviews] = useState<ReviewInfo[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewCursor, setReviewCursor] = useState<string | null>(null);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const reviewObserverTarget = useRef<HTMLDivElement>(null);
  // 각 리뷰의 expanded 상태 관리 (리뷰 ID를 키로 사용)
  const [expandedReviews, setExpandedReviews] = useState<Record<number, boolean>>({});
  
  // 설명이 길면 잘라서 보여줄 길이 (약 3줄 정도)
  const MAX_DESCRIPTION_LENGTH = 200;
  // 리뷰 content를 잘라서 보여줄 길이 (약 3-4줄 정도)
  const MAX_REVIEW_CONTENT_LENGTH = 150;

  // 인원 상태 관리
  const [adultCount, setAdultCount] = useState(() => {
    return searchParams.get("adultOccupancy") ? parseInt(searchParams.get("adultOccupancy") || "1") : 1;
  });
  const [childCount, setChildCount] = useState(() => {
    return searchParams.get("childOccupancy") ? parseInt(searchParams.get("childOccupancy") || "0") : 0;
  });
  const [infantCount, setInfantCount] = useState(() => {
    return searchParams.get("infantOccupancy") ? parseInt(searchParams.get("infantOccupancy") || "0") : 0;
  });
  const [petCount, setPetCount] = useState(() => {
    return searchParams.get("petOccupancy") ? parseInt(searchParams.get("petOccupancy") || "0") : 0;
  });

  // YYYY-MM-DD 문자열을 로컬 시간대 Date 객체로 변환
  const parseDateFromUrl = (dateString: string): Date => {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // 체크인/체크아웃 날짜 계산
  const { checkIn, checkOut, nights, totalPrice } = useMemo(() => {
    const urlCheckIn = searchParams.get("checkIn");
    const urlCheckOut = searchParams.get("checkOut");
    
    if (urlCheckIn && urlCheckOut && accommodation) {
      const checkInDate = parseDateFromUrl(urlCheckIn);
      const checkOutDate = parseDateFromUrl(urlCheckOut);
      const nightsCount = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      const total = accommodation.base_price * nightsCount;
      return {
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: nightsCount,
        totalPrice: total,
      };
    }
    
    // 체크인만 있는 경우
    if (urlCheckIn && accommodation) {
      const checkInDate = parseDateFromUrl(urlCheckIn);
      return {
        checkIn: checkInDate,
        checkOut: null,
        nights: 0,
        totalPrice: 0,
      };
    }
    
    // 날짜가 없으면 예약 가능한 날짜부터 1박
    if (accommodation) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // unavailable_dates를 Date 객체로 변환
      const unavailableDates = accommodation.unavailable_dates.map(date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      });
      
      // 예약 가능한 날짜 찾기
      let checkInDate = new Date(today);
      while (unavailableDates.some(ud => ud.getTime() === checkInDate.getTime())) {
        checkInDate.setDate(checkInDate.getDate() + 1);
      }
      
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 1);
      
      return {
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: 1,
        totalPrice: accommodation.base_price,
      };
    }
    
    return {
      checkIn: null,
      checkOut: null,
      nights: 0,
      totalPrice: 0,
    };
  }, [searchParams, accommodation]);

  // 날짜 포맷팅 함수
  const formatDate = (date: Date | null): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}. ${month}. ${day}.`;
  };

  useEffect(() => {
    const fetchAccommodation = async () => {
      if (!id) return;

      setIsLoading(true);
      clearError();

      try {
        const data = await accommodationApi.getDetail(parseInt(id));
        setAccommodation(data);
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccommodation();
  }, [id, handleError, clearError]);

  // 리뷰 목록 가져오기
  const fetchReviews = useCallback(async (cursor?: string | null) => {
    if (!id || !accommodation) return;

    // total_count가 0이면 리뷰를 가져오지 않음
    if (accommodation.review_summary.total_count === 0) {
      setReviews([]);
      setAllReviews([]);
      setReviewCursor(null);
      setHasMoreReviews(false);
      return;
    }

    setIsLoadingReviews(true);
    clearError();

    try {
      // 리뷰가 6개 이하인 경우 size=6, 6개 초과인 경우도 size=6으로 설정
      const size = 6;
      const response = await reviewApi.getReviews(Number(id), {
        sortType: ReviewSortType.LATEST,
        size,
        cursor: cursor || undefined,
      });

      const fetchedReviews = response.reviews || [];
      const pageInfo = response.page_info;

      if (cursor) {
        // 추가 로드 (무한 스크롤)
        setAllReviews((prev) => [...prev, ...fetchedReviews]);
      } else {
        // 첫 로드
        setReviews(fetchedReviews);
        setAllReviews(fetchedReviews);
      }

      setReviewCursor(pageInfo.next_cursor || null);
      setHasMoreReviews(pageInfo.has_next || false);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingReviews(false);
    }
  }, [id, accommodation, clearError, handleError]);

  useEffect(() => {
    if (id && accommodation) {
      fetchReviews();
    }
  }, [id, accommodation, fetchReviews]);

  // 무한 스크롤을 위한 Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreReviews && !isLoadingReviews && reviewCursor) {
          fetchReviews(reviewCursor);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = reviewObserverTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMoreReviews, isLoadingReviews, reviewCursor, fetchReviews]);
  
  // URL 파라미터에서 인원 정보 동기화 (숙소 데이터 로드 후)
  useEffect(() => {
    if (!accommodation) return;
    
        const adult = searchParams.get("adultOccupancy") ? parseInt(searchParams.get("adultOccupancy") || "1") : 1;
        const child = searchParams.get("childOccupancy") ? parseInt(searchParams.get("childOccupancy") || "0") : 0;
        const infant = searchParams.get("infantOccupancy") ? parseInt(searchParams.get("infantOccupancy") || "0") : 0;
        const pet = searchParams.get("petOccupancy") ? parseInt(searchParams.get("petOccupancy") || "0") : 0;
        
        setAdultCount(adult);
        setChildCount(child);
        setInfantCount(infant);
        setPetCount(pet);
  }, [accommodation, searchParams]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (isGuestPickerOpen && guestPickerRef.current && !guestPickerRef.current.contains(target)) {
        setIsGuestPickerOpen(false);
      }
      
      if (isDatePickerOpen) {
        const isInsideDatePicker = datePickerRef.current?.contains(target);
        const isInsideDateSection = dateSectionRef.current?.contains(target);
        
        if (!isInsideDatePicker && !isInsideDateSection) {
          setIsDatePickerOpen(false);
        }
      }
    };

    if (isGuestPickerOpen || isDatePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isGuestPickerOpen, isDatePickerOpen]);
  
  // 날짜를 YYYY-MM-DD 형식의 로컬 시간대 문자열로 변환
  const formatDateForUrl = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
  const handleDateSelect = (newCheckIn: Date | null, newCheckOut: Date | null) => {
    if (!id) return;
    
    // startTransition으로 URL 업데이트를 낮은 우선순위로 처리하여 깜빡임 방지
    startTransition(() => {
    const params = new URLSearchParams(searchParams);
    
      if (newCheckIn) {
        params.set("checkIn", formatDateForUrl(newCheckIn));
    } else {
      params.delete("checkIn");
      }
      
      if (newCheckOut) {
        params.set("checkOut", formatDateForUrl(newCheckOut));
        // 체크아웃까지 선택 완료되면 달력 닫기
        setIsDatePickerOpen(false);
      } else {
      params.delete("checkOut");
    }
    
      setSearchParams(params, { replace: true });
    });
  };

  const handleReserve = async () => {
    if (!isAuthenticated) {
      setPendingAction(() => async () => {
        await handleReserve();
      });
      setIsAuthModalOpen(true);
      return;
    }

    if (!id || !accommodation) {
      handleError(new Error("숙소 정보를 불러올 수 없습니다."));
      return;
    }

    if (!checkIn || !checkOut) {
      handleError(new Error("체크인/체크아웃 날짜를 선택해주세요."));
      return;
    }

    clearError();

    try {
      const checkInStr = formatDateForUrl(checkIn);
      const checkOutStr = formatDateForUrl(checkOut);
      const guestCount = adultCount + childCount;
      
      const reservationResponse = await reservationApi.create({
        accommodation_id: accommodation.id,
        check_in_date: checkInStr,
        check_out_date: checkOutStr,
        guest_count: guestCount,
      });

      const { reservation_uid, order_name, amount, customer_email, customer_name } = reservationResponse;
      
      // 예약 생성 성공 시 확인 및 결제 페이지로 이동 (결제 정보 + 예약 박스 정보 포함)
      const params = new URLSearchParams();
      params.set("reservationUid", reservation_uid);
      params.set("orderName", order_name);
      params.set("amount", amount.toString());
      params.set("customerEmail", customer_email);
      params.set("customerName", customer_name);
      // 예약 박스에서 입력한 정보도 함께 전달
      params.set("checkIn", checkInStr);
      params.set("checkOut", checkOutStr);
      params.set("adultOccupancy", adultCount.toString());
      params.set("childOccupancy", childCount.toString());
      params.set("infantOccupancy", infantCount.toString());
      params.set("petOccupancy", petCount.toString());
      navigate(`/accommodations/${id}/confirm?${params.toString()}`);
    } catch (err) {
      handleError(err);
    }
  };

  // 최근 조회에 추가 (로그인한 사용자만)
  useEffect(() => {
    const addToRecentlyViewed = async () => {
      if (!id || !isAuthenticated || !accommodation) return;

      try {
        await recentlyViewedApi.add(parseInt(id));
      } catch (err) {
        // 최근 조회 추가 실패는 조용히 처리 (사용자에게 에러를 보여주지 않음)
        console.error("최근 조회 추가 실패:", err);
      }
    };

    addToRecentlyViewed();
  }, [id, isAuthenticated, accommodation]);

  // 모바일 이미지 슬라이더 터치 핸들러
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || !accommodation) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    const maxIndex = accommodation.images.length - 1;
    
    if (isLeftSwipe && mobileSlideIndex < maxIndex) {
      setMobileSlideIndex(mobileSlideIndex + 1);
    }
    if (isRightSwipe && mobileSlideIndex > 0) {
      setMobileSlideIndex(mobileSlideIndex - 1);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className={styles.loading}>로딩 중...</div>
      </MainLayout>
    );
  }

  if (!accommodation) {
    return (
      <MainLayout>
        <div className={styles.error}>숙소를 찾을 수 없습니다.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <div className={styles.titleWrapper}>
              <h1 className={styles.title}>{accommodation.name}</h1>
              <div className={styles.meta}>
                {accommodation.review_summary.total_count > 0 && (
                  <div className={styles.review}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.star}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span>{accommodation.review_summary.average_rating.toFixed(1)}</span>
                    <span className={styles.reviewCount}>
                      ({accommodation.review_summary.total_count})
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.actionButtons}>
              <button className={styles.shareButton} onClick={() => {}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                <span>공유하기</span>
              </button>
              <button 
                className={styles.saveButton} 
                onClick={() => {
                  if (!isAuthenticated) {
                    setPendingAction(() => () => setIsWishlistModalOpen(true));
                    setIsAuthModalOpen(true);
                  } else {
                    setIsWishlistModalOpen(true);
                  }
                }}
              >
                <svg 
                  viewBox="0 0 24 24" 
                  fill={accommodation.is_in_wishlist ? "#ff385c" : "none"} 
                  stroke={accommodation.is_in_wishlist ? "#ff385c" : "currentColor"} 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span>{accommodation.is_in_wishlist ? "저장 목록" : "저장"}</span>
              </button>
            </div>
          </div>
        </div>

        {accommodation.images.length > 0 && (
          <div className={styles.imageSection}>
            {/* 데스크톱 이미지 그리드 */}
            <div className={styles.imageGrid}>
              <div 
                className={styles.mainImage}
                onClick={() => {
                  setCurrentImageIndex(0);
                  setIsImageGalleryOpen(true);
                }}
              >
                <img
                  src={getImageUrl(accommodation.images[0].image_url)}
                  alt={accommodation.name}
                  className={styles.image}
                />
              </div>
              <div className={styles.thumbnailGrid}>
                {Array.from({ length: 4 }).map((_, index) => {
                  const imageIndex = index + 1;
                  const image = accommodation.images[imageIndex];
                  
                  if (image) {
                    return (
                      <button
                        key={image.id}
                        className={styles.thumbnail}
                        onClick={() => {
                          setCurrentImageIndex(imageIndex);
                          setIsImageGalleryOpen(true);
                        }}
                      >
                        <img src={getImageUrl(image.image_url)} alt={`${accommodation.name} ${imageIndex + 1}`} />
                        {index === 3 && accommodation.images.length > 5 && (
                          <div 
                            className={styles.viewAllButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentImageIndex(0);
                              setIsImageGalleryOpen(true);
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                              <rect x="6" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                              <rect x="11" y="1" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                              <rect x="1" y="6" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                              <rect x="6" y="6" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                              <rect x="11" y="6" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                              <rect x="1" y="11" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                              <rect x="6" y="11" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                              <rect x="11" y="11" width="4" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            </svg>
                            <span>사진 모두 보기</span>
                          </div>
                        )}
                      </button>
                    );
                  } else {
                    // 플레이스홀더
                    return (
                      <div key={`placeholder-${index}`} className={styles.thumbnailPlaceholder}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </div>
                    );
                  }
                })}
              </div>
            </div>

            {/* 모바일/태블릿 이미지 슬라이더 */}
            <div 
              className={styles.mobileImageSlider}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onClick={() => {
                setCurrentImageIndex(mobileSlideIndex);
                setIsImageGalleryOpen(true);
              }}
            >
              <div 
                className={styles.sliderContainer}
                style={{ transform: `translateX(-${mobileSlideIndex * 100}%)` }}
              >
                {accommodation.images.map((image, index) => (
                  <img
                    key={image.id}
                    src={getImageUrl(image.image_url)}
                    alt={`${accommodation.name} ${index + 1}`}
                    className={styles.slideImage}
                  />
                ))}
              </div>
              <div className={styles.sliderIndicator}>
                {mobileSlideIndex + 1} / {accommodation.images.length}
              </div>
              {accommodation.images.length <= 5 && (
                <div className={styles.sliderDots}>
                  {accommodation.images.map((_, index) => (
                    <button
                      key={index}
                      className={`${styles.sliderDot} ${index === mobileSlideIndex ? styles.active : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMobileSlideIndex(index);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.contentWrapper}>
          <div className={styles.leftColumn}>
            <div className={styles.locationSection}>
              <div className={styles.locationInfo}>
                <span className={styles.address}>
                  {accommodation.address_summary.city || accommodation.address_summary.country}의 {getAccommodationTypeKorean(accommodation.type)}
                </span>
                <span className={styles.maxOccupancy}>최대 인원 {accommodation.policy.max_occupancy}명</span>
              </div>
            </div>

            {accommodation.amenities.length > 0 && (
              <div className={styles.amenitiesSection}>
                <div className={styles.amenitiesGrid}>
                  {accommodation.amenities.map((amenity, index) => (
                    <div key={index} className={styles.amenityItem}>
                      {getAmenityIcon(amenity.type)}
                      <span>{getAmenityTypeKorean(amenity.type)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.mainContent}>
              <section className={styles.section}>
                <div className={styles.hostInfo}>
                  <div className={styles.hostAvatar}>
                    {accommodation.host.thumbnail_image_url ? (
                      <img
                        src={getImageUrl(accommodation.host.thumbnail_image_url)}
                        alt={accommodation.host.nickname}
                      />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {accommodation.host.nickname.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className={styles.hostDetails}>
                    <span className={styles.hostLabel}>호스트:</span>
                    <span className={styles.hostName}>{accommodation.host.nickname} 님</span>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                {accommodation.description && (
                  <>
                    <p className={styles.description}>
                      {accommodation.description.length > MAX_DESCRIPTION_LENGTH
                        ? `${accommodation.description.substring(0, MAX_DESCRIPTION_LENGTH)}...`
                        : accommodation.description}
                    </p>
                    {accommodation.description.length > MAX_DESCRIPTION_LENGTH && (
                      <button
                        className={styles.showMoreButton}
                        onClick={() => setIsDescriptionModalOpen(true)}
                      >
                        더 보기
                      </button>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>

          <div className={styles.sidebar}>
            <div className={styles.bookingCard}>
              <div className={styles.priceSection}>
                <span className={styles.totalPrice}>₩{totalPrice.toLocaleString()}</span>
                <span className={styles.priceInfo}>· {nights}박</span>
              </div>
              
              <div className={styles.dateSection} ref={dateSectionRef}>
                <div 
                  className={styles.dateRow}
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  style={{ cursor: "pointer" }}
                >
                  <div className={styles.dateColumn}>
                    <div className={styles.dateLabel}>체크인</div>
                    <div className={styles.dateValue}>{formatDate(checkIn)}</div>
                  </div>
                  <div className={styles.dateDivider}></div>
                  <div className={styles.dateColumn}>
                    <div className={styles.dateLabel}>체크아웃</div>
                    <div className={styles.dateValue}>{formatDate(checkOut)}</div>
                  </div>
                </div>
                <div className={styles.horizontalDivider}></div>
                
                {isDatePickerOpen && (
                  <div className={styles.datePickerContainer}>
                    <DatePicker
                      checkIn={checkIn}
                      checkOut={checkOut}
                      onDateSelect={handleDateSelect}
                      onClose={() => setIsDatePickerOpen(false)}
                      datePickerRef={datePickerRef}
                      unavailableDates={accommodation?.unavailable_dates?.map(date => {
                        // LocalDate 형식 (YYYY-MM-DD)을 그대로 사용
                        if (typeof date === 'string') {
                          return date;
                        }
                        // Date 객체인 경우 변환
                        const d = new Date(date);
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                      }) || []}
                    />
                  </div>
                )}
              </div>
              
              <div className={`${styles.guestRowContainer} ${isDatePickerOpen ? styles.hidden : ''}`} ref={guestPickerRef}>
                  <div 
                    className={styles.guestRow}
                    onClick={() => setIsGuestPickerOpen(!isGuestPickerOpen)}
                  >
                    <div className={styles.guestColumn}>
                      <div className={styles.dateLabel}>인원</div>
                      <div className={styles.guestValue}>
                        {(() => {
                          const guestCount = adultCount + childCount;
                          const parts: string[] = [];
                          
                          if (guestCount > 0) {
                            parts.push(`게스트 ${guestCount}명`);
                          }
                          if (infantCount > 0) {
                            parts.push(`유아 ${infantCount}명`);
                          }
                          if (petCount > 0) {
                            parts.push(`반려동물 ${petCount}마리`);
                          }
                          
                          return parts.length > 0 ? parts.join(", ") : "게스트 1명";
                        })()}
                      </div>
                    </div>
                    <div className={styles.guestArrow}>{isGuestPickerOpen ? "⌃" : "⌄"}</div>
                  </div>
                  
                  {isGuestPickerOpen && (
                    <div className={styles.guestPicker}>
                      <div className={styles.guestPickerItem}>
                        <div className={styles.guestPickerLabel}>
                          <div className={styles.guestPickerTitle}>성인</div>
                          <div className={styles.guestPickerSubtitle}>13세 이상</div>
                        </div>
                        <div className={styles.guestPickerControls}>
                          <button
                            className={`${styles.guestPickerButton} ${adultCount <= 1 ? styles.guestPickerButtonDisabled : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (adultCount > 1) setAdultCount(adultCount - 1);
                            }}
                            disabled={adultCount <= 1}
                          >
                            −
                          </button>
                          <span className={styles.guestPickerCount}>{adultCount}</span>
                          <button
                            className={`${styles.guestPickerButton} ${adultCount + childCount >= (accommodation?.policy.max_occupancy || 10) ? styles.guestPickerButtonDisabled : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (adultCount + childCount < (accommodation?.policy.max_occupancy || 10)) {
                                setAdultCount(adultCount + 1);
                              }
                            }}
                            disabled={adultCount + childCount >= (accommodation?.policy.max_occupancy || 10)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      <div className={styles.guestPickerItem}>
                        <div className={styles.guestPickerLabel}>
                          <div className={styles.guestPickerTitle}>어린이</div>
                          <div className={styles.guestPickerSubtitle}>2~12세</div>
                        </div>
                        <div className={styles.guestPickerControls}>
                          <button
                            className={`${styles.guestPickerButton} ${childCount <= 0 ? styles.guestPickerButtonDisabled : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (childCount > 0) setChildCount(childCount - 1);
                            }}
                            disabled={childCount <= 0}
                          >
                            −
                          </button>
                          <span className={styles.guestPickerCount}>{childCount}</span>
                          <button
                            className={`${styles.guestPickerButton} ${adultCount + childCount >= (accommodation?.policy.max_occupancy || 10) ? styles.guestPickerButtonDisabled : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (adultCount + childCount < (accommodation?.policy.max_occupancy || 10)) {
                                setChildCount(childCount + 1);
                              }
                            }}
                            disabled={adultCount + childCount >= (accommodation?.policy.max_occupancy || 10)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      <div className={styles.guestPickerItem}>
                        <div className={styles.guestPickerLabel}>
                          <div className={styles.guestPickerTitle}>유아</div>
                          <div className={styles.guestPickerSubtitle}>2세 미만</div>
                        </div>
                        <div className={styles.guestPickerControls}>
                          <button
                            className={`${styles.guestPickerButton} ${infantCount <= 0 || (accommodation?.policy.infant_occupancy || 0) === 0 ? styles.guestPickerButtonDisabled : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (infantCount > 0) setInfantCount(infantCount - 1);
                            }}
                            disabled={infantCount <= 0 || (accommodation?.policy.infant_occupancy || 0) === 0}
                          >
                            −
                          </button>
                          <span className={styles.guestPickerCount}>{infantCount}</span>
                          <button
                            className={`${styles.guestPickerButton} ${infantCount >= (accommodation?.policy.infant_occupancy || 0) || (accommodation?.policy.infant_occupancy || 0) === 0 ? styles.guestPickerButtonDisabled : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (infantCount < (accommodation?.policy.infant_occupancy || 0)) {
                                setInfantCount(infantCount + 1);
                              }
                            }}
                            disabled={infantCount >= (accommodation?.policy.infant_occupancy || 0) || (accommodation?.policy.infant_occupancy || 0) === 0}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      <div className={styles.guestPickerItem}>
                        <div className={styles.guestPickerLabel}>
                          <div className={styles.guestPickerTitle}>반려동물</div>
                          <div className={styles.guestPickerSubtitle}>
                            {(accommodation?.policy.pet_occupancy || 0) === 0 ? (
                              <span className={styles.guestPickerLink}>보조동물을 동반하시나요?</span>
                            ) : (
                              "반려동물"
                            )}
                          </div>
                        </div>
                        <div className={styles.guestPickerControls}>
                          <button
                            className={`${styles.guestPickerButton} ${petCount <= 0 || (accommodation?.policy.pet_occupancy || 0) === 0 ? styles.guestPickerButtonDisabled : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (petCount > 0) setPetCount(petCount - 1);
                            }}
                            disabled={petCount <= 0 || (accommodation?.policy.pet_occupancy || 0) === 0}
                          >
                            −
                          </button>
                          <span className={styles.guestPickerCount}>{petCount}</span>
                          <button
                            className={`${styles.guestPickerButton} ${petCount >= (accommodation?.policy.pet_occupancy || 0) || (accommodation?.policy.pet_occupancy || 0) === 0 ? styles.guestPickerButtonDisabled : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (petCount < (accommodation?.policy.pet_occupancy || 0)) {
                                setPetCount(petCount + 1);
                              }
                            }}
                            disabled={petCount >= (accommodation?.policy.pet_occupancy || 0) || (accommodation?.policy.pet_occupancy || 0) === 0}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      <div className={styles.guestPickerNote}>
                        이 숙소의 최대 숙박 인원은 {accommodation?.policy.max_occupancy || 0}명(유아 제외)입니다.{" "}
                        {(accommodation?.policy.pet_occupancy || 0) === 0 && "반려동물 동반은 허용되지 않습니다."}
                      </div>
                      
                      <button
                        className={styles.guestPickerClose}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsGuestPickerOpen(false);
                        }}
                      >
                        닫기
                      </button>
                    </div>
                  )}
              </div>
              
              <button
                className={styles.reserveButton}
                onClick={handleReserve}
              >
                예약하기
              </button>
              
              <div className={styles.bookingNote}>
                예약 확정 전에는 요금이 청구되지 않습니다.
              </div>
            </div>
          </div>
        </div>
        </div>

        <section className={`${styles.section} ${styles.locationSectionFullWidth}`}>
          <h2 className={styles.sectionTitle}>위치</h2>
          <p className={styles.address}>
            {[
              accommodation.address_summary.city,
              accommodation.address_summary.country,
            ].filter(Boolean).join(", ")}
          </p>
          {accommodation.coordinate.latitude && accommodation.coordinate.longitude && (
            <div className={styles.mapContainer}>
              {GOOGLE_MAPS_API_KEY ? (
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${accommodation.coordinate.latitude},${accommodation.coordinate.longitude}&zoom=15`}
                />
              ) : (
                <div className={styles.mapPlaceholder}>
                  지도 (위도: {accommodation.coordinate.latitude}, 경도:{" "}
                  {accommodation.coordinate.longitude})
                </div>
              )}
            </div>
          )}
        </section>

        {/* Reviews Section */}
        {accommodation.review_summary.total_count > 0 && (
          <section className={`${styles.section} ${styles.reviewSection}`}>
            <h2 className={styles.sectionTitle}>
              ★ {accommodation.review_summary.average_rating.toFixed(2)} · 후기 {accommodation.review_summary.total_count}개
            </h2>
            
            {reviews.length > 0 && (
              <div className={styles.reviewsGrid}>
                {reviews.map((review) => (
                  <div key={review.id} className={styles.reviewCard}>
                    <div className={styles.reviewHeader}>
                      <div className={styles.reviewerInfo}>
                        {review.reviewer.thumbnail_image_url ? (
                          <img
                            src={getImageUrl(review.reviewer.thumbnail_image_url)}
                            alt={review.reviewer.nickname}
                            className={styles.reviewerAvatar}
                          />
                        ) : (
                          <div className={styles.reviewerAvatarPlaceholder}>
                            {review.reviewer.nickname.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className={styles.reviewerDetails}>
                          <div className={styles.reviewerName}>{review.reviewer.nickname}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className={styles.reviewRating}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          viewBox="0 0 24 24"
                          fill={i < review.rating ? "currentColor" : "none"}
                          stroke="currentColor"
                          className={styles.starIcon}
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ))}
                    </div>
                    
                    <div className={styles.reviewDate}>
                      {new Date(review.reviewed_at).getFullYear()}년 {new Date(review.reviewed_at).getMonth() + 1}월
                    </div>
                    
                    <div className={styles.reviewContent}>
                      {expandedReviews[review.id] || review.content.length <= MAX_REVIEW_CONTENT_LENGTH
                        ? review.content
                        : `${review.content.substring(0, MAX_REVIEW_CONTENT_LENGTH)}...`}
                    </div>
                    
                    {review.content.length > MAX_REVIEW_CONTENT_LENGTH && (
                      <button
                        className={styles.reviewShowMoreButton}
                        onClick={() => {
                          // "더보기" 버튼 클릭 시 리뷰 모달 열기 (후기 모두 보기와 같은 기능)
                          setIsReviewModalOpen(true);
                        }}
                      >
                        더보기
                      </button>
                    )}
                    
                    {review.images && review.images.length > 0 && (
                      <div className={styles.reviewImages}>
                        {review.images.map((image) => (
                          <img
                            key={image.id}
                            src={getImageUrl(image.image_url)}
                            alt="리뷰 이미지"
                            className={styles.reviewImage}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* 리뷰가 6개 초과인 경우에만 "모두 보기" 버튼 표시 */}
            {accommodation.review_summary.total_count > 6 && (
              <div className={styles.reviewViewAll}>
                <button 
                  className={styles.reviewViewAllButton}
                  onClick={() => setIsReviewModalOpen(true)}
                >
                  후기 {accommodation.review_summary.total_count}개 모두 보기
                </button>
              </div>
            )}
          </section>
        )}

        {accommodation && (
        <>
          <ReviewModal
            isOpen={isReviewModalOpen}
            onClose={() => setIsReviewModalOpen(false)}
            reviews={allReviews}
            averageRating={accommodation.review_summary.average_rating}
            totalCount={accommodation.review_summary.total_count}
          />
          <WishlistModal
            isOpen={isWishlistModalOpen}
            onClose={() => setIsWishlistModalOpen(false)}
            accommodationId={accommodation.id}
            onSuccess={async () => {
              // 위시리스트 변경 후 accommodation 데이터 다시 불러오기
              if (id) {
                try {
                  const data = await accommodationApi.getDetail(parseInt(id));
                  setAccommodation(data);
                } catch (err) {
                  handleError(err);
                }
              }
            }}
          />
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => {
              setIsAuthModalOpen(false);
              setPendingAction(null);
            }}
            onSuccess={() => {
              if (pendingAction) {
                pendingAction();
                setPendingAction(null);
              }
            }}
          />
        </>
      )}

      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}

      {isDescriptionModalOpen && accommodation && (
        <div className={styles.descriptionModal} onClick={() => setIsDescriptionModalOpen(false)}>
          <div className={styles.descriptionModalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.descriptionModalClose}
              onClick={() => setIsDescriptionModalOpen(false)}
            >
              ×
            </button>
            <h2 className={styles.descriptionModalTitle}>숙소 설명</h2>
            <div className={styles.descriptionModalText}>
              {accommodation.description.split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  {index < accommodation.description.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {isImageGalleryOpen && accommodation && (
        <div className={styles.galleryModal} onClick={() => setIsImageGalleryOpen(false)}>
          <div className={styles.galleryContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.galleryClose}
              onClick={() => setIsImageGalleryOpen(false)}
            >
              ×
            </button>
            <div className={styles.galleryMain}>
              <img
                src={getImageUrl(accommodation.images[currentImageIndex].image_url)}
                alt={`${accommodation.name} ${currentImageIndex + 1}`}
                className={styles.galleryImage}
              />
              {accommodation.images.length > 1 && (
                <>
                  <button
                    className={`${styles.galleryNav} ${styles.galleryPrev}`}
                    onClick={() => setCurrentImageIndex((prev) => 
                      prev === 0 ? accommodation.images.length - 1 : prev - 1
                    )}
                    disabled={accommodation.images.length <= 1}
                  >
                    ‹
                  </button>
                  <button
                    className={`${styles.galleryNav} ${styles.galleryNext}`}
                    onClick={() => setCurrentImageIndex((prev) => 
                      prev === accommodation.images.length - 1 ? 0 : prev + 1
                    )}
                    disabled={accommodation.images.length <= 1}
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            <div className={styles.galleryThumbnails}>
              {accommodation.images.map((image, index) => (
                <button
                  key={image.id}
                  className={`${styles.galleryThumbnail} ${
                    index === currentImageIndex ? styles.galleryThumbnailActive : ""
                  }`}
                  onClick={() => setCurrentImageIndex(index)}
                >
                  <img src={getImageUrl(image.image_url)} alt={`${accommodation.name} ${index + 1}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default AccommodationDetail;
