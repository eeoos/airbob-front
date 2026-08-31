import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import type { Review } from "../model";

export interface ReviewViewModel {
  id: number;
  rating: number;
  author: {
    id: number;
    name: string;
    avatarUrl: string;
    avatarInitial: string;
  };
  date: {
    iso: string;
    label: string;
    timestamp: number;
  };
  content: string;
  images: Array<{
    id: number;
    url: string;
    alt: string;
  }>;
}

const getAvatarInitial = (name: string) => name.trim().charAt(0).toUpperCase();

const formatReviewDateLabel = (isoDate: string) => {
  const date = new Date(isoDate);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
};

export const toReviewViewModel = (review: Review): ReviewViewModel => {
  return {
    id: review.id,
    rating: review.rating,
    author: {
      id: review.reviewer.id,
      name: review.reviewer.nickname,
      avatarUrl: resolveImageUrl(review.reviewer.thumbnailImageUrl),
      avatarInitial: getAvatarInitial(review.reviewer.nickname),
    },
    date: {
      iso: review.reviewedAt,
      label: formatReviewDateLabel(review.reviewedAt),
      timestamp: new Date(review.reviewedAt).getTime(),
    },
    content: review.content,
    images: review.images.map((image) => ({
      id: image.id,
      url: resolveImageUrl(image.imageUrl),
      alt: "리뷰 이미지",
    })),
  };
};

export const toReviewViewModels = (reviews: readonly Review[]) =>
  reviews.map(toReviewViewModel);
