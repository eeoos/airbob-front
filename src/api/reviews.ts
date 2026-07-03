import { client } from "./client";
import { unwrapApiResponse } from "./response";
import {
  CreateReviewRequest,
  CreateReviewData,
  UpdateReviewRequest,
  UpdateReviewData,
  UploadReviewImagesData,
  ReviewInfos,
  ReviewSummary,
} from "../types/review";
import { ReviewSortType } from "../types/enums";
import { ApiResponse } from "../types/api";

export const reviewApi = {
  // 리뷰 작성
  create: async (
    accommodationId: number,
    request: CreateReviewRequest
  ): Promise<CreateReviewData> => {
    const response = await client.post<ApiResponse<CreateReviewData>>(
      `/accommodations/${accommodationId}/reviews`,
      request
    );
    return unwrapApiResponse(response.data);
  },

  // 리뷰 수정
  update: async (
    reviewId: number,
    request: UpdateReviewRequest
  ): Promise<UpdateReviewData> => {
    const response = await client.patch<ApiResponse<UpdateReviewData>>(
      `/reviews/${reviewId}`,
      request
    );
    return unwrapApiResponse(response.data);
  },

  // 리뷰 삭제
  delete: async (reviewId: number): Promise<void> => {
    const response = await client.delete<ApiResponse<null>>(`/reviews/${reviewId}`);
    unwrapApiResponse(response.data, { allowNull: true });
  },

  // 리뷰 이미지 업로드
  uploadImages: async (
    reviewId: number,
    images: File[]
  ): Promise<UploadReviewImagesData> => {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append("images", image);
    });

    const response = await client.post<ApiResponse<UploadReviewImagesData>>(
      `/reviews/${reviewId}/images`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return unwrapApiResponse(response.data);
  },

  // 리뷰 이미지 삭제
  deleteImage: async (reviewId: number, imageId: number): Promise<void> => {
    const response = await client.delete<ApiResponse<null>>(
      `/reviews/${reviewId}/images/${imageId}`
    );
    unwrapApiResponse(response.data, { allowNull: true });
  },

  // 리뷰 목록 조회
  getReviews: async (
    accommodationId: number,
    params?: {
      sortType?: ReviewSortType;
      size?: number;
      cursor?: string;
    }
  ): Promise<ReviewInfos> => {
    const response = await client.get<ApiResponse<ReviewInfos>>(
      `/accommodations/${accommodationId}/reviews`,
      { params }
    );
    return unwrapApiResponse(response.data);
  },

  // 리뷰 요약 조회
  getSummary: async (accommodationId: number): Promise<ReviewSummary> => {
    const response = await client.get<ApiResponse<ReviewSummary>>(
      `/accommodations/${accommodationId}/reviews/summary`
    );
    return unwrapApiResponse(response.data);
  },
};
