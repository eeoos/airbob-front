export type ReviewSortType = "LATEST" | "HIGHEST_RATING" | "LOWEST_RATING";

export interface ReviewApiRequestOptions {
  readonly signal?: AbortSignal;
}

export interface ReviewImage {
  readonly id: number;
  readonly imageUrl: string;
}

export interface ReviewAuthor {
  readonly id: number;
  readonly nickname: string;
  readonly thumbnailImageUrl: string | null;
}

export interface Review {
  readonly id: number;
  readonly rating: number;
  readonly content: string;
  readonly reviewedAt: string;
  readonly reviewer: ReviewAuthor;
  readonly images: readonly ReviewImage[];
}

export interface ReviewPageInfo {
  readonly hasNext: boolean;
  readonly nextCursor: string | null;
  readonly currentSize: number;
}

export interface ReviewPage {
  readonly reviews: readonly Review[];
  readonly pageInfo: ReviewPageInfo;
}

export interface ReviewListParams {
  readonly sortType: ReviewSortType;
  readonly size: number;
  readonly cursor?: string;
}

export interface CreateReviewInput {
  readonly rating: number;
  readonly content: string;
}

export interface CreatedReview {
  readonly reviewId: number;
}

export interface UploadedReviewImages {
  readonly uploadedImages: readonly ReviewImage[];
}
