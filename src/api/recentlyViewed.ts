import { client } from "./client";
import {
  GetRecentlyViewedResponse,
  AddRecentlyViewedResponse,
  DeleteRecentlyViewedResponse,
} from "../types/recentlyViewed";
import { ApiResponse } from "../types/api";

export const recentlyViewedApi = {
  // 최근 조회 목록 조회
  getRecentlyViewed: async (): Promise<GetRecentlyViewedResponse> => {
    const response = await client.get<GetRecentlyViewedResponse>("/members/recently-viewed");
    return response.data;
  },

  // 최근 조회 추가
  add: async (accommodationId: number): Promise<AddRecentlyViewedResponse> => {
    const response = await client.post<AddRecentlyViewedResponse>(
      `/members/recently-viewed/${accommodationId}`
    );
    return response.data;
  },

  // 최근 조회 삭제
  remove: async (accommodationId: number): Promise<DeleteRecentlyViewedResponse> => {
    const response = await client.delete<DeleteRecentlyViewedResponse>(
      `/members/recently-viewed/${accommodationId}`
    );
    return response.data;
  },
};





