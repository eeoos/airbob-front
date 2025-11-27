import { AccommodationStatus, AccommodationType, AmenityType } from "./enums";
import { CursorPageInfo, PageInfo } from "./api";

// 공통 타입
export interface Coordinate {
  latitude: number | null;
  longitude: number | null;
}

export interface AddressSummaryInfo {
  country: string;
  state: string | null;
  city: string;
  district: string | null;
}

export interface AddressInfo {
  country: string;
  state: string | null;
  city: string;
  district: string | null;
  street: string;
  detail: string | null;
  postal_code: string;
}

export interface MemberInfo {
  id: number;
  nickname: string;
  thumbnail_image_url: string | null;
}

export interface PolicyInfo {
  max_occupancy: number;
  infant_occupancy: number;
  pet_occupancy: number;
}

export interface AmenityInfo {
  type: AmenityType;
  count: number;
}

export interface ImageInfo {
  id: number;
  image_url: string;
}

export interface ReviewSummary {
  total_count: number;
  average_rating: number;
}

// 검색 관련
export interface AccommodationSearchRequest {
  destination?: string;
  minPrice?: number;
  maxPrice?: number;
  checkIn?: string; // YYYY-MM-DD
  checkOut?: string; // YYYY-MM-DD
  adultOccupancy?: number;
  childOccupancy?: number;
  infantOccupancy?: number;
  petOccupancy?: number;
  amenityTypes?: string[];
  accommodationTypes?: string[];
  topLeftLat?: number;
  topLeftLng?: number;
  bottomRightLat?: number;
  bottomRightLng?: number;
  page?: number;
  size?: number;
}

export interface AccommodationSearchInfo {
  id: number;
  name: string;
  accommodation_thumbnail_url: string | null;
  base_price: number;
  currency: string;
  type: AccommodationType;
  address_summary: AddressSummaryInfo;
  coordinate: Coordinate;
  review_summary: ReviewSummary;
  is_in_wishlist: boolean;
}

export interface AccommodationSearchResponse {
  stay_search_result_listing: AccommodationSearchInfo[];
  page_info: PageInfo;
}

// 숙소 상세 조회 (Public)
export interface AccommodationDetail {
  id: number;
  name: string;
  description: string;
  type: AccommodationType;
  base_price: number;
  currency: string;
  check_in_time: string; // HH:mm:ss
  check_out_time: string; // HH:mm:ss
  unavailable_dates: string[]; // YYYY-MM-DD[]
  is_in_wishlist: boolean;
  address_summary: AddressSummaryInfo;
  coordinate: Coordinate;
  host: MemberInfo;
  policy: PolicyInfo;
  amenities: AmenityInfo[];
  images: ImageInfo[];
  review_summary: ReviewSummary;
}

// 호스트 숙소 상세 조회
export interface HostAccommodationDetail {
  id: number;
  name: string | null;
  description: string | null;
  type: AccommodationType | null;
  base_price: number | null;
  currency: string | null;
  check_in_time: string | null; // HH:mm:ss
  check_out_time: string | null; // HH:mm:ss
  address: AddressInfo | null;
  coordinate: Coordinate | null;
  host: MemberInfo;
  policy: PolicyInfo | null;
  amenities: AmenityInfo[];
  images: ImageInfo[];
  review_summary: ReviewSummary;
}

// 호스트 숙소 목록
export interface HostAccommodationInfo {
  id: number;
  name: string | null;
  thumbnail_url: string | null;
  status: AccommodationStatus;
  type: AccommodationType | null;
  address_summary: AddressSummaryInfo | null;
  created_at: string;
}

export interface HostAccommodationInfos {
  accommodations: HostAccommodationInfo[];
  page_info: CursorPageInfo;
}

// 숙소 기본 정보 (예약 등에서 사용)
export interface AccommodationBasicInfo {
  id: number;
  name: string;
  thumbnail_url: string | null;
}

// 숙소 생성 응답
export interface CreateAccommodationResponse {
  id: number;
}

// 숙소 이미지 업로드 응답
export interface UploadImagesResponse {
  uploaded_images: ImageInfo[];
}

// Legacy alias (하위 호환성)
export type MyAccommodationInfo = HostAccommodationInfo;
export type MyAccommodationInfos = HostAccommodationInfos;
