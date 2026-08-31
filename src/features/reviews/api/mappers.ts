import type {
  CreatedReview,
  CreateReviewInput,
  Review,
  ReviewImage,
  ReviewPage,
  UploadedReviewImages,
} from "../model";
import type {
  CreatedReviewWire,
  CreateReviewWireRequest,
  ReviewImageWire,
  ReviewPageWire,
  ReviewWire,
  UploadedReviewImagesWire,
} from "./contracts";

const toReviewImage = (wire: ReviewImageWire): ReviewImage => ({
  id: wire.id,
  imageUrl: wire.image_url,
});

const toReview = (wire: ReviewWire): Review => ({
  id: wire.id,
  rating: wire.rating,
  content: wire.content,
  reviewedAt: wire.reviewed_at,
  reviewer: {
    id: wire.reviewer.id,
    nickname: wire.reviewer.nickname,
    thumbnailImageUrl: wire.reviewer.thumbnail_image_url,
  },
  images: wire.images.map(toReviewImage),
});

export const toReviewPage = (wire: ReviewPageWire): ReviewPage => ({
  reviews: wire.reviews.map(toReview),
  pageInfo: {
    hasNext: wire.page_info.has_next,
    nextCursor: wire.page_info.next_cursor,
    currentSize: wire.page_info.current_size,
  },
});

export const toCreateReviewWireRequest = (
  input: CreateReviewInput,
): CreateReviewWireRequest => ({
  content: input.content.trim(),
  rating: input.rating,
});

export const toCreatedReview = (wire: CreatedReviewWire): CreatedReview => ({
  reviewId: wire.id,
});

export const toUploadedReviewImages = (
  wire: UploadedReviewImagesWire,
): UploadedReviewImages => ({
  uploadedImages: wire.uploaded_images.map(toReviewImage),
});
