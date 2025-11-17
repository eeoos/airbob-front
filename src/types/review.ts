import { ApiResponse, CursorPageInfo } from "./api";
import { ReviewSortType } from "./enums";

// 리뷰 작성
export interface CreateReviewRequest {
  rating: number; // 1-5
  content: string;
}

export interface CreateReviewData {
  id: number;
}

export type CreateReviewResponse = ApiResponse<CreateReviewData>;

// 리뷰 수정
export interface UpdateReviewRequest {
  content: string;
}

export interface UpdateReviewData {
  id: number;
}

export type UpdateReviewResponse = ApiResponse<UpdateReviewData>;

// 리뷰 삭제
export type DeleteReviewResponse = ApiResponse<null>;

// 리뷰 이미지 업로드
export interface UploadReviewImagesData {
  uploaded_images: ImageInfo[];
}

export interface ImageInfo {
  id: number;
  image_url: string;
}

export type UploadReviewImagesResponse = ApiResponse<UploadReviewImagesData>;

// 리뷰 이미지 삭제
export type DeleteReviewImageResponse = ApiResponse<null>;

// 리뷰 목록 조회
export interface ReviewerInfo {
  id: number;
  nickname: string;
  thumbnail_image_url: string | null;
  joined_at: string;
}

export interface ReviewInfo {
  id: number;
  rating: number;
  content: string;
  reviewed_at: string;
  reviewer: ReviewerInfo;
  images: ImageInfo[];
}

export interface ReviewInfos {
  reviews: ReviewInfo[];
  page_info: CursorPageInfo;
}

export type GetReviewsResponse = ApiResponse<ReviewInfos>;

// 리뷰 요약
export interface ReviewSummary {
  total_count: number;
  average_rating: number;
}

export type GetReviewSummaryResponse = ApiResponse<ReviewSummary>;

