import { act, renderHook, waitFor } from "@testing-library/react";
import type { SessionSubject } from "../../platform/session/sessionScope";
import { useAccommodationReviewFeed } from "./useAccommodationReviewFeed";

const mockReviewsQuery = vi.fn();

vi.mock("../../features/reviews/public", async () => ({
  ...(await vi.importActual<typeof import("../../features/reviews/public")>(
    "../../features/reviews/public",
  )),
  useAccommodationReviewsReadQuery: (...args: unknown[]) =>
    mockReviewsQuery(...args),
}));

describe("useAccommodationReviewFeed", () => {
  beforeEach(() => mockReviewsQuery.mockReset());

  it("waits for an explicit visibility event before requesting each new cursor", async () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
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
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    };
    mockReviewsQuery.mockImplementation(() => queryResult);
    const { result, rerender } = renderHook(() =>
      useAccommodationReviewFeed({
        accommodationId: 7,
        enabled: true,
        onError: vi.fn(),
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

  it("reports a failed cursor once and retries only from the explicit action", async () => {
    const fetchNextPage = vi.fn().mockRejectedValue(new Error("failed"));
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
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    const onError = vi.fn();
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

    act(() => result.current.retryNextReviewPage());
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(2));
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it("owns initial loading, error retry, empty, and ready states", async () => {
    const refetch = vi.fn();
    let queryResult: Record<string, unknown> = {
      data: undefined,
      error: null,
      errorUpdatedAt: 0,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isError: false,
      isFetching: true,
      isFetchingNextPage: false,
      isLoading: true,
      refetch,
    };
    mockReviewsQuery.mockImplementation(() => queryResult);
    const onError = vi.fn();
    const { result, rerender } = renderHook(() =>
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

    expect(result.current.status).toBe("loading");

    queryResult = {
      ...queryResult,
      error: { kind: "network" },
      errorUpdatedAt: 1,
      isError: true,
      isFetching: false,
      isLoading: false,
    };
    rerender();
    expect(result.current.status).toBe("error");
    act(() => result.current.retryReviewFeed());
    expect(refetch).toHaveBeenCalledTimes(1);

    queryResult = {
      ...queryResult,
      data: {
        pages: [
          {
            reviews: [],
            pageInfo: { hasNext: false, nextCursor: null },
          },
        ],
      },
      error: null,
      isError: false,
    };
    rerender();
    expect(result.current.status).toBe("empty");
  });
});
