import { act, renderHook, waitFor } from "@testing-library/react";
import type { SessionSubject } from "../../platform/session/sessionScope";
import { useAccommodationReviewFeed } from "./useAccommodationReviewFeed";

const mockReviewsQuery = jest.fn();

jest.mock("../../features/reviews/public", () => ({
  ...jest.requireActual("../../features/reviews/public"),
  useAccommodationReviewsReadQuery: (...args: unknown[]) =>
    mockReviewsQuery(...args),
}));

describe("useAccommodationReviewFeed", () => {
  beforeEach(() => mockReviewsQuery.mockReset());

  it("waits for an explicit visibility event before requesting each new cursor", async () => {
    const fetchNextPage = jest.fn().mockResolvedValue(undefined);
    let queryResult = {
      data: {
        pages: [
          {
            reviews: [],
            pageInfo: { hasNext: true, nextCursor: "cursor-2" },
          },
        ],
      },
      error: null,
      errorUpdatedAt: 0,
      fetchNextPage,
      hasNextPage: true,
      isError: false,
      isFetchingNextPage: false,
    };
    mockReviewsQuery.mockImplementation(() => queryResult);
    const { result, rerender } = renderHook(() =>
      useAccommodationReviewFeed({
        accommodationId: 7,
        enabled: true,
        onError: jest.fn(),
        scope: {
          subject: "subject:member_1" as SessionSubject,
          epoch: 2,
        },
      }),
    );

    act(() => result.current.openReviewModal());
    expect(fetchNextPage).not.toHaveBeenCalled();

    await act(async () => result.current.loadNextReviewPage());
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    await act(async () => result.current.loadNextReviewPage());
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    queryResult = {
      ...queryResult,
      data: {
        pages: [
          ...queryResult.data.pages,
          {
            reviews: [],
            pageInfo: { hasNext: true, nextCursor: "cursor-3" },
          },
        ],
      },
    };
    rerender();
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    await act(async () => result.current.loadNextReviewPage());
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it("reports a failed cursor once until the modal lifecycle restarts", async () => {
    const fetchNextPage = jest.fn().mockRejectedValue(new Error("failed"));
    mockReviewsQuery.mockReturnValue({
      data: {
        pages: [
          {
            reviews: [],
            pageInfo: { hasNext: true, nextCursor: "cursor-2" },
          },
        ],
      },
      error: null,
      errorUpdatedAt: 0,
      fetchNextPage,
      hasNextPage: true,
      isError: false,
      isFetchingNextPage: false,
    });
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useAccommodationReviewFeed({
        accommodationId: 7,
        enabled: true,
        onError,
        scope: {
          subject: "subject:member_1" as SessionSubject,
          epoch: 2,
        },
      }),
    );

    act(() => result.current.openReviewModal());
    await act(async () => result.current.loadNextReviewPage());
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
      ),
    );

    await act(async () => result.current.loadNextReviewPage());
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    act(() => result.current.closeReviewModal());
    act(() => result.current.openReviewModal());
    await act(async () => result.current.loadNextReviewPage());
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });
});
