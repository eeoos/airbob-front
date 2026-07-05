import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { reviewApi } from "../../../api";
import { ReviewInfo, ReviewInfos } from "../../../types/review";
import { ReviewSortType } from "../../../types/enums";
import { useAccommodationReviews } from "./useAccommodationReviews";

jest.mock("../../../api", () => ({
  reviewApi: {
    getReviews: jest.fn(),
  },
}));

const mockHandleError = jest.fn();
const mockClearError = jest.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function QueryClientTestWrapper({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
};

const createReview = (id: number): ReviewInfo => ({
  id,
  rating: 5,
  content: `후기 ${id}`,
  reviewed_at: "2026-07-01T00:00:00",
  reviewer: {
    id,
    nickname: `게스트 ${id}`,
    thumbnail_image_url: null,
  },
  images: [],
});

const createReviewResponse = (
  reviews: ReviewInfo[],
  hasNext: boolean,
  cursor: string | null
): ReviewInfos => ({
  reviews,
  page_info: {
    has_next: hasNext,
    next_cursor: cursor,
    current_size: reviews.length,
  },
});

describe("useAccommodationReviews", () => {
  beforeEach(() => {
    mockHandleError.mockReset();
    mockClearError.mockReset();
    jest.mocked(reviewApi.getReviews).mockReset();
  });

  it("skips fetching and clears review state when total review count is zero", async () => {
    const { result } = renderHook(
      () =>
        useAccommodationReviews({
          accommodationId: "7",
          totalReviewCount: 0,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoadingReviews).toBe(false));

    expect(reviewApi.getReviews).not.toHaveBeenCalled();
    expect(result.current.reviews).toEqual([]);
    expect(result.current.allReviews).toEqual([]);
    expect(result.current.hasMoreReviews).toBe(false);
  });

  it("loads the first review page with latest sort and page size six", async () => {
    const firstPage = [createReview(1), createReview(2)];
    jest
      .mocked(reviewApi.getReviews)
      .mockResolvedValue(createReviewResponse(firstPage, true, "cursor-1"));

    const { result } = renderHook(
      () =>
        useAccommodationReviews({
          accommodationId: "7",
          totalReviewCount: 12,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoadingReviews).toBe(false));

    expect(reviewApi.getReviews).toHaveBeenCalledWith(7, {
      sortType: ReviewSortType.LATEST,
      size: 6,
      cursor: undefined,
    });
    expect(result.current.reviews).toEqual(firstPage);
    expect(result.current.allReviews).toEqual(firstPage);
    expect(result.current.reviewCursor).toBe("cursor-1");
    expect(result.current.hasMoreReviews).toBe(true);
  });

  it("appends reviews when fetching with a cursor", async () => {
    const firstPage = [createReview(1)];
    const secondPage = [createReview(2)];
    jest
      .mocked(reviewApi.getReviews)
      .mockResolvedValueOnce(createReviewResponse(firstPage, true, "cursor-1"))
      .mockResolvedValueOnce(createReviewResponse(secondPage, false, null));

    const { result } = renderHook(
      () =>
        useAccommodationReviews({
          accommodationId: "7",
          totalReviewCount: 12,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.reviewCursor).toBe("cursor-1"));

    await act(async () => {
      await result.current.fetchReviews("cursor-1");
    });

    expect(result.current.reviews).toEqual(firstPage);
    expect(result.current.allReviews).toEqual([...firstPage, ...secondPage]);
    expect(result.current.hasMoreReviews).toBe(false);
  });

  it("routes API errors through the provided handler", async () => {
    const error = new Error("reviews failed");
    jest.mocked(reviewApi.getReviews).mockRejectedValue(error);

    const { result } = renderHook(
      () =>
        useAccommodationReviews({
          accommodationId: "7",
          totalReviewCount: 1,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoadingReviews).toBe(false));

    expect(mockHandleError).toHaveBeenCalledWith(error);
  });
});
