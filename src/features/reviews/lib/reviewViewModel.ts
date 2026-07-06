import type { ReviewInfo } from "../../../types/review";
import { getImageUrl } from "../../../utils/image";

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

const getAvatarInitial = (name: string) =>
  name.trim().charAt(0).toUpperCase();

const formatReviewDateLabel = (isoDate: string) => {
  const date = new Date(isoDate);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
};

export const toReviewViewModel = (review: ReviewInfo): ReviewViewModel => ({
  id: review.id,
  rating: review.rating,
  author: {
    id: review.reviewer.id,
    name: review.reviewer.nickname,
    avatarUrl: getImageUrl(review.reviewer.thumbnail_image_url),
    avatarInitial: getAvatarInitial(review.reviewer.nickname),
  },
  date: {
    iso: review.reviewed_at,
    label: formatReviewDateLabel(review.reviewed_at),
    timestamp: new Date(review.reviewed_at).getTime(),
  },
  content: review.content,
  images: review.images.map((image) => ({
    id: image.id,
    url: getImageUrl(image.image_url),
    alt: "리뷰 이미지",
  })),
});

export const toReviewViewModels = (reviews: ReviewInfo[]) =>
  reviews.map(toReviewViewModel);
