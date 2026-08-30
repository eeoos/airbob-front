import type {
  CreatedReview,
  CreateReviewInput,
  ReviewApiRequestOptions,
  ReviewListParams,
  ReviewPage,
  UploadedReviewImages,
} from "../model";

export interface ReviewReadApiPort {
  getReviews(
    accommodationId: number,
    params: ReviewListParams,
    options?: ReviewApiRequestOptions,
  ): Promise<ReviewPage>;
}

export interface ReviewSubmissionApiPort {
  createReview(
    accommodationId: number,
    input: CreateReviewInput,
    options?: ReviewApiRequestOptions,
  ): Promise<CreatedReview>;
  uploadReviewImages(
    reviewId: number,
    images: readonly File[],
    options?: ReviewApiRequestOptions,
  ): Promise<UploadedReviewImages>;
}

export interface ReviewApiPort
  extends ReviewReadApiPort,
    ReviewSubmissionApiPort {}
