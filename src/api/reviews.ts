import { client } from "./client";
import {
  CreateReviewRequest,
  CreateReviewResponse,
  UpdateReviewRequest,
  UpdateReviewResponse,
  DeleteReviewResponse,
  UploadReviewImagesResponse,
  DeleteReviewImageResponse,
  GetReviewsResponse,
  GetReviewSummaryResponse,
} from "../types/review";
import { ReviewSortType } from "../types/enums";
import { ApiResponse } from "../types/api";

export const reviewApi = {
  // 리뷰 작성
  create: async (
    accommodationId: number,
    request: CreateReviewRequest
  ): Promise<CreateReviewResponse> => {
    const response = await client.post<CreateReviewResponse>(
      `/accommodations/${accommodationId}/reviews`,
      request
    );
    return response.data;
  },

  // 리뷰 수정
  update: async (
    reviewId: number,
    request: UpdateReviewRequest
  ): Promise<UpdateReviewResponse> => {
    const response = await client.patch<UpdateReviewResponse>(`/reviews/${reviewId}`, request);
    return response.data;
  },

  // 리뷰 삭제
  delete: async (reviewId: number): Promise<DeleteReviewResponse> => {
    const response = await client.delete<DeleteReviewResponse>(`/reviews/${reviewId}`);
    return response.data;
  },

  // 리뷰 이미지 업로드
  uploadImages: async (
    reviewId: number,
    images: File[]
  ): Promise<UploadReviewImagesResponse> => {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append("images", image);
    });

    const response = await client.post<UploadReviewImagesResponse>(
      `/reviews/${reviewId}/images`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  // 리뷰 이미지 삭제
  deleteImage: async (reviewId: number, imageId: number): Promise<DeleteReviewImageResponse> => {
    const response = await client.delete<DeleteReviewImageResponse>(
      `/reviews/${reviewId}/images/${imageId}`
    );
    return response.data;
  },

  // 리뷰 목록 조회
  getReviews: async (
    accommodationId: number,
    params?: {
      sortType?: ReviewSortType;
      size?: number;
      cursor?: string;
    }
  ): Promise<GetReviewsResponse> => {
    const response = await client.get<GetReviewsResponse>(
      `/accommodations/${accommodationId}/reviews`,
      { params }
    );
    return response.data;
  },

  // 리뷰 요약 조회
  getSummary: async (accommodationId: number): Promise<GetReviewSummaryResponse> => {
    const response = await client.get<GetReviewSummaryResponse>(
      `/accommodations/${accommodationId}/reviews/summary`
    );
    return response.data;
  },
};





