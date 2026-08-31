import { requestApiData } from "../../../platform/http/request";
import type { ReviewListParams } from "../model";
import type { ReviewApiPort } from "../ports/reviewApiPort";
import type {
  CreatedReviewWire,
  ReviewPageWire,
  UploadedReviewImagesWire,
} from "./contracts";
import {
  toCreatedReview,
  toCreateReviewWireRequest,
  toReviewPage,
  toUploadedReviewImages,
} from "./mappers";

type ReviewApiTransport = typeof requestApiData;

const toReviewListWireParams = ({
  cursor,
  size,
  sortType,
}: ReviewListParams) => ({
  ...(cursor ? { cursor } : {}),
  size,
  sortType,
});

const createReviewApi = (request: ReviewApiTransport): ReviewApiPort => ({
  async getReviews(accommodationId, params, options) {
    const wire = await request<ReviewPageWire>({
      method: "GET",
      path: `/accommodations/${accommodationId}/reviews`,
      params: toReviewListWireParams(params),
      signal: options?.signal,
    });

    return toReviewPage(wire);
  },

  async createReview(accommodationId, input, options) {
    const wire = await request<CreatedReviewWire>({
      method: "POST",
      path: `/accommodations/${accommodationId}/reviews`,
      body: toCreateReviewWireRequest(input),
      signal: options?.signal,
    });

    return toCreatedReview(wire);
  },

  async uploadReviewImages(reviewId, images, options) {
    const body = new FormData();
    images.forEach((image) => body.append("images", image));
    const wire = await request<UploadedReviewImagesWire>({
      method: "POST",
      path: `/reviews/${reviewId}/images`,
      body,
      bodyEncoding: "multipart",
      signal: options?.signal,
    });

    return toUploadedReviewImages(wire);
  },
});

export const reviewApi = createReviewApi(requestApiData);
