import { ApiResponse } from "./api";
import { AddressSummaryInfo, ReviewSummary } from "./accommodation";

// 최근 조회 숙소 정보
export interface RecentlyViewedAccommodationInfo {
  viewed_at: string;
  accommodation_id: number;
  accommodation_name: string;
  thumbnail_url: string | null;
  address_summary: AddressSummaryInfo;
  review_summary: ReviewSummary;
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
