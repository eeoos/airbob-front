import { client } from "./client";
import {
  AccommodationSearchRequest,
  AccommodationSearchResponse,
  AccommodationDetail,
  MyAccommodationInfos,
} from "../types/accommodation";
import { ApiResponse } from "../types/api";

export const accommodationApi = {
  // 숙소 검색
  search: async (params: AccommodationSearchRequest): Promise<AccommodationSearchResponse> => {
    const response = await client.get<ApiResponse<AccommodationSearchResponse>>(
      "/search/accommodations",
      { params }
    );
    return response.data.data!;
  },

  // 숙소 상세 조회
  getDetail: async (accommodationId: number): Promise<AccommodationDetail> => {
    const response = await client.get<ApiResponse<AccommodationDetail>>(
      `/accommodations/${accommodationId}`
    );
    return response.data.data!;
  },

  // 숙소 초안 생성
  create: async (): Promise<{ id: number }> => {
    const response = await client.post<ApiResponse<{ id: number }>>("/accommodations");
    return response.data.data!;
  },

  // 숙소 수정
  update: async (
    accommodationId: number,
    data: {
      name?: string;
      description?: string;
      base_price?: number;
      address_info?: any;
      amenity_infos?: any[];
      occupancy_policy_info?: any;
      type?: string;
      check_in_time?: string;
      check_out_time?: string;
    }
  ): Promise<void> => {
    await client.patch<ApiResponse<null>>(`/accommodations/${accommodationId}`, data);
  },

  // 숙소 공개
  publish: async (accommodationId: number): Promise<void> => {
    await client.patch<ApiResponse<null>>(`/accommodations/${accommodationId}/publish`);
  },

  // 숙소 비공개
  unpublish: async (accommodationId: number): Promise<void> => {
    await client.patch<ApiResponse<null>>(`/accommodations/${accommodationId}/unpublish`);
  },

  // 숙소 삭제
  delete: async (accommodationId: number): Promise<void> => {
    await client.delete<ApiResponse<null>>(`/accommodations/${accommodationId}`);
  },

  // 숙소 이미지 업로드
  uploadImages: async (
    accommodationId: number,
    images: File[],
    onUploadProgress?: (progress: number) => void
  ): Promise<{ uploaded_images: Array<{ id: number; image_url: string }> }> => {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append("images", image);
    });

    const response = await client.post<ApiResponse<{ uploaded_images: Array<{ id: number; image_url: string }> }>>(
      `/accommodations/${accommodationId}/images`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onUploadProgress) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onUploadProgress(percentCompleted);
          }
        },
      }
    );
    return response.data.data!;
  },

  // 숙소 이미지 삭제
  deleteImage: async (accommodationId: number, imageId: number): Promise<void> => {
    await client.delete<ApiResponse<null>>(`/accommodations/${accommodationId}/images/${imageId}`);
  },

  // 호스트 숙소 목록 조회
  getMyAccommodations: async (params?: {
    size?: number;
    cursor?: string;
    status?: "PUBLISHED" | "DRAFT" | "UNPUBLISHED";
  }): Promise<MyAccommodationInfos> => {
    const response = await client.get<ApiResponse<MyAccommodationInfos>>(
      "/profile/host/accommodations",
      { params }
    );
    return response.data.data!;
  },

  // 호스트 숙소 상세 조회
  getHostAccommodationDetail: async (accommodationId: number): Promise<AccommodationDetail> => {
    const response = await client.get<ApiResponse<AccommodationDetail>>(
      `/profile/host/accommodations/${accommodationId}`
    );
    return response.data.data!;
  },
};
