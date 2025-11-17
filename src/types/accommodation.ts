import { AccommodationStatus, AccommodationType, AmenityType } from "./enums";
import { CursorPageInfo, PageInfo } from "./api";

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

export interface Coordinate {
  latitude: number | null;
  longitude: number | null;
}

export interface PriceResponse {
  currency_code: string;
  display_price: string;
  price: string;
}

export interface ReviewSummary {
  total_count: number;
  average_rating: number;
}

export interface AccommodationSearchInfo {
  id: number;
  name: string;
  location_summary: string;
  accommodation_thumbnail_url: string;
  coordinate: Coordinate;
  price_per_night: PriceResponse;
  review: ReviewSummary;
  is_in_wishlist: boolean;
}

export interface AccommodationSearchResponse {
  stay_search_result_listing: AccommodationSearchInfo[];
  page_info: PageInfo;
}

// 숙소 상세
export interface AddressInfo {
  country: string;
  city: string;
  district: string;
  street: string;
  detail: string;
  postal_code: string;
  full_address: string;
}

export interface HostInfo {
  id: number;
  nickname: string;
  profile_image_url: string | null;
}

export interface PolicyInfo {
  max_occupancy: number;
  adult_occupancy: number;
  child_occupancy: number;
  infant_occupancy: number;
  pet_occupancy: number;
}

export interface AmenityInfo {
  type: AmenityType;
  count: number;
}

export interface AccommodationDetail {
  id: number;
  name: string;
  description: string;
  type: AccommodationType;
  base_price: number;
  check_in_time: string; // HH:mm:ss
  check_out_time: string; // HH:mm:ss
  address: AddressInfo;
  coordinate: Coordinate;
  host: HostInfo;
  policy_info: PolicyInfo;
  amenities: AmenityInfo[];
  image_urls: string[];
  review_summary: ReviewSummary;
  unavailable_dates: string[]; // YYYY-MM-DD[]
  is_in_wishlist: boolean;
}

// 호스트 숙소 목록
export interface MyAccommodationInfo {
  id: number;
  name: string | null;
  thumbnail_url: string | null;
  status: AccommodationStatus;
  type: AccommodationType | null;
  location: string | null;
  created_at: string;
}

export interface MyAccommodationInfos {
  accommodations: MyAccommodationInfo[];
  page_info: CursorPageInfo;
}





