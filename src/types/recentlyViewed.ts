import { ApiResponse } from "./api";

// 최근 조회 목록
export interface RecentlyViewedAccommodationInfo {
  viewed_at: string;
  accommodation_id: number;
  accommodation_name: string;
  thumbnail_url: string | null;
  location_summary: string;
  average_rating: number;
  review_count: number;
  is_in_wishlist: boolean;
}

export interface RecentlyViewedAccommodationInfos {
  accommodations: RecentlyViewedAccommodationInfo[];
  total_count: number;
}

export type GetRecentlyViewedResponse = ApiResponse<RecentlyViewedAccommodationInfos>;

// 최근 조회 추가
export type AddRecentlyViewedResponse = ApiResponse<null>;

// 최근 조회 삭제
export type DeleteRecentlyViewedResponse = ApiResponse<null>;







