import { requestApiData } from "../../../platform/http/request";
import { reviewApi } from "./reviewApi";

vi.mock("../../../platform/http/request", () => ({
  requestApiData: vi.fn(),
}));

const mockRequestApiData = vi.mocked(requestApiData);

describe("review API adapter", () => {
  beforeEach(() => {
    mockRequestApiData.mockReset();
  });

  it("preserves the review-list request and maps wire fields to the owned model", async () => {
    const signal = new AbortController().signal;
    mockRequestApiData.mockResolvedValue({
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
      reviewApi.getReviews(
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
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: "/accommodations/31/reviews",
      params: { cursor: "cursor-1", size: 6, sortType: "LATEST" },
      signal,
    });
  });

  it("omits an absent cursor without changing the current list contract", async () => {
    mockRequestApiData.mockResolvedValue({
      reviews: [],
      page_info: { current_size: 0, has_next: false, next_cursor: null },
    });

    await reviewApi.getReviews(31, { size: 6, sortType: "LATEST" });

    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: "/accommodations/31/reviews",
      params: { size: 6, sortType: "LATEST" },
      signal: undefined,
    });
  });

  it("trims review content and preserves the create path and JSON body", async () => {
    const signal = new AbortController().signal;
    mockRequestApiData.mockResolvedValue({ id: 901 });

    await expect(
      reviewApi.createReview(
        31,
        { content: "  clean and quiet  ", rating: 5 },
        { signal },
      ),
    ).resolves.toEqual({ reviewId: 901 });
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "POST",
      path: "/accommodations/31/reviews",
      body: { content: "clean and quiet", rating: 5 },
      signal,
    });
  });

  it("uploads files as repeated images fields in selection order and maps the result", async () => {
    const signal = new AbortController().signal;
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.jpg", {
      type: "image/jpeg",
    });
    mockRequestApiData.mockResolvedValue({
      uploaded_images: [
        { id: 1, image_url: "/first.png" },
        { id: 2, image_url: "/second.jpg" },
      ],
    });

    await expect(
      reviewApi.uploadReviewImages(901, [first, second], { signal }),
    ).resolves.toEqual({
      uploadedImages: [
        { id: 1, imageUrl: "/first.png" },
        { id: 2, imageUrl: "/second.jpg" },
      ],
    });

    const requestInput = mockRequestApiData.mock.calls.at(0)?.at(0);
    if (!requestInput)
      throw new Error("Expected a review image upload request");
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
