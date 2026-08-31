import type { ReviewApiTransport } from "./reviewApi";
import { createReviewApi } from "./reviewApi";

const createTransport = () => {
  const request = vi.fn();

  return {
    request,
    transport: request as ReviewApiTransport,
  };
};

describe("review API adapter", () => {
  it("preserves the review-list request and maps wire fields to the owned model", async () => {
    const { request, transport } = createTransport();
    const api = createReviewApi(transport);
    const signal = new AbortController().signal;
    request.mockResolvedValue({
      reviews: [
        {
          id: 91,
          rating: 4,
          content: "quiet stay",
          reviewed_at: "2026-08-30T00:00:00Z",
          reviewer: {
            id: 7,
            nickname: "guest",
            thumbnail_image_url: null,
          },
          images: [{ id: 13, image_url: "/review-13.png" }],
        },
      ],
      page_info: {
        current_size: 1,
        has_next: true,
        next_cursor: "cursor-2",
      },
    });

    await expect(
      api.getReviews(
        31,
        { cursor: "cursor-1", size: 6, sortType: "LATEST" },
        { signal },
      ),
    ).resolves.toEqual({
      reviews: [
        {
          id: 91,
          rating: 4,
          content: "quiet stay",
          reviewedAt: "2026-08-30T00:00:00Z",
          reviewer: {
            id: 7,
            nickname: "guest",
            thumbnailImageUrl: null,
          },
          images: [{ id: 13, imageUrl: "/review-13.png" }],
        },
      ],
      pageInfo: {
        currentSize: 1,
        hasNext: true,
        nextCursor: "cursor-2",
      },
    });
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/accommodations/31/reviews",
      params: { cursor: "cursor-1", size: 6, sortType: "LATEST" },
      signal,
    });
  });

  it("omits an absent cursor without changing the current list contract", async () => {
    const { request, transport } = createTransport();
    const api = createReviewApi(transport);
    request.mockResolvedValue({
      reviews: [],
      page_info: { current_size: 0, has_next: false, next_cursor: null },
    });

    await api.getReviews(31, { size: 6, sortType: "LATEST" });

    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/accommodations/31/reviews",
      params: { size: 6, sortType: "LATEST" },
      signal: undefined,
    });
  });

  it("trims review content and preserves the create path and JSON body", async () => {
    const { request, transport } = createTransport();
    const api = createReviewApi(transport);
    const signal = new AbortController().signal;
    request.mockResolvedValue({ id: 901 });

    await expect(
      api.createReview(
        31,
        { content: "  clean and quiet  ", rating: 5 },
        { signal },
      ),
    ).resolves.toEqual({ reviewId: 901 });
    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/accommodations/31/reviews",
      body: { content: "clean and quiet", rating: 5 },
      signal,
    });
  });

  it("uploads files as repeated images fields in selection order and maps the result", async () => {
    const { request, transport } = createTransport();
    const api = createReviewApi(transport);
    const signal = new AbortController().signal;
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.jpg", {
      type: "image/jpeg",
    });
    request.mockResolvedValue({
      uploaded_images: [
        { id: 1, image_url: "/first.png" },
        { id: 2, image_url: "/second.jpg" },
      ],
    });

    await expect(
      api.uploadReviewImages(901, [first, second], { signal }),
    ).resolves.toEqual({
      uploadedImages: [
        { id: 1, imageUrl: "/first.png" },
        { id: 2, imageUrl: "/second.jpg" },
      ],
    });

    const requestInput = request.mock.calls[0][0];
    expect(requestInput).toMatchObject({
      bodyEncoding: "multipart",
      method: "POST",
      path: "/reviews/901/images",
      signal,
    });
    expect(requestInput.body).toBeInstanceOf(FormData);
    expect((requestInput.body as FormData).getAll("images")).toEqual([
      first,
      second,
    ]);
    expect(Array.from((requestInput.body as FormData).keys())).toEqual([
      "images",
      "images",
    ]);
  });
});
