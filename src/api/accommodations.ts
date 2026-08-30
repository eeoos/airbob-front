import { client } from "./client";
import { requestApi, requestApiNullable } from "./request";
import {
  AccommodationDetail,
  HostAccommodationInfos,
  CreateAccommodationResponse,
} from "../types/accommodation";
import { AccommodationStatus } from "../types/enums";
import { ApiResponse } from "../types/api";

export const accommodationApi = {
  // 숙소 상세 조회 (Public)
  getDetail: async (accommodationId: number): Promise<AccommodationDetail> => {
    return requestApi(() =>
      client.get<ApiResponse<AccommodationDetail>>(`/accommodations/${accommodationId}`)
    );
  },

  // 숙소 초안 생성
  create: async (): Promise<CreateAccommodationResponse> => {
    return requestApi(() =>
      client.post<ApiResponse<CreateAccommodationResponse>>("/accommodations")
    );
  },

  // 숙소 비공개
  unpublish: async (accommodationId: number): Promise<void> => {
    await requestApiNullable(() =>
      client.patch<ApiResponse<null>>(`/accommodations/${accommodationId}/unpublish`)
    );
  },

  // 숙소 삭제
  delete: async (accommodationId: number): Promise<void> => {
    await requestApiNullable(() =>
      client.delete<ApiResponse<null>>(`/accommodations/${accommodationId}`)
    );
  },

  // 호스트 숙소 목록 조회
  getMyAccommodations: async (params?: {
    size?: number;
    cursor?: string;
    status?: AccommodationStatus;
  }): Promise<HostAccommodationInfos> => {
    return requestApi(() =>
      client.get<ApiResponse<HostAccommodationInfos>>("/profile/host/accommodations", { params })
    );
  },

};
