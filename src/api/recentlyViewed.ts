import { client } from "./client";
import { unwrapApiResponse } from "./response";
import { RecentlyViewedAccommodationInfos } from "../types/recentlyViewed";
import { ApiResponse } from "../types/api";

export const recentlyViewedApi = {
  // 최근 조회 목록 조회
  getRecentlyViewed: async (): Promise<RecentlyViewedAccommodationInfos> => {
    const response = await client.get<ApiResponse<RecentlyViewedAccommodationInfos>>("/members/recently-viewed");
    return unwrapApiResponse(response.data);
  },

  // 최근 조회 추가
  add: async (accommodationId: number): Promise<void> => {
    const response = await client.post<ApiResponse<null>>(`/members/recently-viewed/${accommodationId}`);
    unwrapApiResponse(response.data, { allowNull: true });
  },

  // 최근 조회 삭제
  remove: async (accommodationId: number): Promise<void> => {
    const response = await client.delete<ApiResponse<null>>(`/members/recently-viewed/${accommodationId}`);
    unwrapApiResponse(response.data, { allowNull: true });
  },
};
