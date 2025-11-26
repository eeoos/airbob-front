import { ApiResponse, CursorPageInfo } from "./api";
import { MemberInfo, ImageInfo } from "./accommodation";

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

export type UploadReviewImagesResponse = ApiResponse<UploadReviewImagesData>;

// 리뷰 이미지 삭제
export type DeleteReviewImageResponse = ApiResponse<null>;

// 리뷰 목록 조회
export interface ReviewInfo {
  id: number;
  rating: number;
  content: string;
  reviewed_at: string;
  reviewer: MemberInfo;
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

// ReviewerInfo 호환성 타입 (deprecated - MemberInfo 사용 권장)
export type ReviewerInfo = MemberInfo;
