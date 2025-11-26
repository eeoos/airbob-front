import { client } from "./client";
import {
  AccommodationSearchRequest,
  AccommodationSearchResponse,
  AccommodationDetail,
  HostAccommodationDetail,
  HostAccommodationInfos,
  CreateAccommodationResponse,
  UploadImagesResponse,
} from "../types/accommodation";
import { AccommodationStatus } from "../types/enums";
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

  // 숙소 상세 조회 (Public)
  getDetail: async (accommodationId: number): Promise<AccommodationDetail> => {
    const response = await client.get<ApiResponse<AccommodationDetail>>(
      `/accommodations/${accommodationId}`
    );
    return response.data.data!;
  },

  // 숙소 초안 생성
  create: async (): Promise<CreateAccommodationResponse> => {
    const response = await client.post<ApiResponse<CreateAccommodationResponse>>("/accommodations");
    return response.data.data!;
  },

  // 숙소 수정
  update: async (
    accommodationId: number,
    data: {
      name?: string;
      description?: string;
      base_price?: number;
      currency?: string;
      address_info?: {
        postal_code: string;
        country: string;
        state?: string;
        city: string;
        district?: string;
        street: string;
        detail?: string;
      };
      amenity_infos?: Array<{
        name: string;
        count: number;
      }>;
      occupancy_policy_info?: {
        max_occupancy: number;
        infant_occupancy: number;
        pet_occupancy: number;
      };
      type?: string;
      check_in_time?: string; // HH:mm 또는 HH:mm:ss
      check_out_time?: string; // HH:mm 또는 HH:mm:ss
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
  ): Promise<UploadImagesResponse> => {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append("images", image);
    });

    const response = await client.post<ApiResponse<UploadImagesResponse>>(
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
    status?: AccommodationStatus;
  }): Promise<HostAccommodationInfos> => {
    const response = await client.get<ApiResponse<HostAccommodationInfos>>(
      "/profile/host/accommodations",
      { params }
    );
    return response.data.data!;
  },

  // 호스트 숙소 상세 조회
  getHostAccommodationDetail: async (accommodationId: number): Promise<HostAccommodationDetail> => {
    const response = await client.get<ApiResponse<HostAccommodationDetail>>(
      `/profile/host/accommodations/${accommodationId}`
    );
    return response.data.data!;
  },
};
