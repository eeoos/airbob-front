import { client } from "./client";
import { requestApi, requestApiNullable } from "./request";
import { RecentlyViewedAccommodationInfos } from "../types/recentlyViewed";
import { ApiResponse } from "../types/api";

export const recentlyViewedApi = {
  // 최근 조회 목록 조회
  getRecentlyViewed: async (): Promise<RecentlyViewedAccommodationInfos> => {
    return requestApi(() =>
      client.get<ApiResponse<RecentlyViewedAccommodationInfos>>("/members/recently-viewed")
    );
  },

  // 최근 조회 추가
  add: async (accommodationId: number): Promise<void> => {
    await requestApiNullable(() =>
      client.post<ApiResponse<null>>(`/members/recently-viewed/${accommodationId}`)
    );
  },

  // 최근 조회 삭제
  remove: async (accommodationId: number): Promise<void> => {
    await requestApiNullable(() =>
      client.delete<ApiResponse<null>>(`/members/recently-viewed/${accommodationId}`)
    );
  },
};
