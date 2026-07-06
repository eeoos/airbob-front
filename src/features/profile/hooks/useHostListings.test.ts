import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { accommodationApi } from "../../../api";
import {
  HostAccommodationInfo,
  HostAccommodationInfos,
} from "../../../types/accommodation";
import { AccommodationStatus } from "../../../types/enums";
import { useHostListings } from "./useHostListings";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../../api", () => ({
  accommodationApi: {
    getMyAccommodations: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

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

const createAccommodation = (
  id: number,
  status = AccommodationStatus.PUBLISHED
): HostAccommodationInfo => ({
    id,
    name: `숙소 ${id}`,
    thumbnail_url: null,
    status,
    type: "ENTIRE_PLACE",
    address_summary: {
      country: "KR",
      state: null,
      city: "Seoul",
      district: "Mapo",
    },
    created_at: "2026-07-01T00:00:00",
  });

const createAccommodationPage = (
  accommodations: HostAccommodationInfo[],
  nextCursor: string | null = null
): HostAccommodationInfos => ({
  accommodations,
  page_info: {
    current_size: accommodations.length,
    has_next: nextCursor !== null,
    next_cursor: nextCursor,
  },
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

describe("useHostListings", () => {
  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockReset();
    jest.mocked(accommodationApi.getMyAccommodations).mockReset();
  });

  it("loads the first host listing page for the selected status", async () => {
    const accommodation = createAccommodation(1);
    jest
      .mocked(accommodationApi.getMyAccommodations)
      .mockResolvedValue(createAccommodationPage([accommodation], "cursor-1"));

    const { result } = renderHook(() => useHostListings("PUBLISHED"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(accommodationApi.getMyAccommodations).toHaveBeenCalledWith({
      size: 20,
      status: AccommodationStatus.PUBLISHED,
    });
    expect(result.current.accommodations).toEqual([accommodation]);
    expect(result.current.hasNext).toBe(true);
  });

  it("appends the next host listing page when loadMore is called", async () => {
    const firstAccommodation = createAccommodation(1);
    const secondAccommodation = createAccommodation(2);
    jest
      .mocked(accommodationApi.getMyAccommodations)
      .mockResolvedValueOnce(
        createAccommodationPage([firstAccommodation], "cursor-1")
      )
      .mockResolvedValueOnce(createAccommodationPage([secondAccommodation]));

    const { result } = renderHook(() => useHostListings("PUBLISHED"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(accommodationApi.getMyAccommodations).toHaveBeenLastCalledWith({
      cursor: "cursor-1",
      size: 20,
      status: AccommodationStatus.PUBLISHED,
    });
    await waitFor(() =>
      expect(result.current.accommodations).toEqual([
        firstAccommodation,
        secondAccommodation,
      ])
    );
    expect(result.current.hasNext).toBe(false);
  });

  it("resets pagination and loads again when status changes", async () => {
    const publishedAccommodation = createAccommodation(
      1,
      AccommodationStatus.PUBLISHED
    );
    const draftAccommodation = createAccommodation(2, AccommodationStatus.DRAFT);
    jest
      .mocked(accommodationApi.getMyAccommodations)
      .mockResolvedValueOnce(
        createAccommodationPage([publishedAccommodation], "published-cursor")
      )
      .mockResolvedValueOnce(createAccommodationPage([draftAccommodation]));

    const { result, rerender } = renderHook(
      ({ statusType }: { statusType: "PUBLISHED" | "DRAFT" }) =>
        useHostListings(statusType),
      {
        initialProps: {
          statusType: "PUBLISHED" as "PUBLISHED" | "DRAFT",
        },
        wrapper: createWrapper(),
      }
    );

    await waitFor(() =>
      expect(result.current.accommodations).toEqual([publishedAccommodation])
    );

    rerender({ statusType: "DRAFT" });

    await waitFor(() =>
      expect(result.current.accommodations).toEqual([draftAccommodation])
    );

    expect(accommodationApi.getMyAccommodations).toHaveBeenLastCalledWith({
      size: 20,
      status: AccommodationStatus.DRAFT,
    });
    expect(result.current.hasNext).toBe(false);
  });

  it("reloads the first page when requested", async () => {
    const firstAccommodation = createAccommodation(1);
    const reloadedAccommodation = createAccommodation(2);
    jest
      .mocked(accommodationApi.getMyAccommodations)
      .mockResolvedValueOnce(createAccommodationPage([firstAccommodation]))
      .mockResolvedValueOnce(createAccommodationPage([reloadedAccommodation]));

    const { result } = renderHook(() => useHostListings("PUBLISHED"), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.accommodations).toEqual([firstAccommodation])
    );

    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() =>
      expect(result.current.accommodations).toEqual([reloadedAccommodation])
    );
    expect(accommodationApi.getMyAccommodations).toHaveBeenCalledTimes(2);
  });

  it("ignores stale first-page responses after the status changes", async () => {
    const publishedAccommodation = createAccommodation(
      1,
      AccommodationStatus.PUBLISHED
    );
    const draftAccommodation = createAccommodation(2, AccommodationStatus.DRAFT);
    const publishedRequest =
      deferred<HostAccommodationInfos>();
    const draftRequest = deferred<HostAccommodationInfos>();

    jest
      .mocked(accommodationApi.getMyAccommodations)
      .mockReturnValueOnce(publishedRequest.promise)
      .mockReturnValueOnce(draftRequest.promise);

    const { result, rerender } = renderHook(
      ({ statusType }: { statusType: "PUBLISHED" | "DRAFT" }) =>
        useHostListings(statusType),
      {
        initialProps: {
          statusType: "PUBLISHED" as "PUBLISHED" | "DRAFT",
        },
        wrapper: createWrapper(),
      }
    );

    rerender({ statusType: "DRAFT" });

    await act(async () => {
      draftRequest.resolve(createAccommodationPage([draftAccommodation]));
      await draftRequest.promise;
    });

    await waitFor(() =>
      expect(result.current.accommodations).toEqual([draftAccommodation])
    );

    await act(async () => {
      publishedRequest.resolve(createAccommodationPage([publishedAccommodation]));
      await publishedRequest.promise;
    });

    expect(result.current.accommodations).toEqual([draftAccommodation]);
  });

  it("does not issue duplicate loadMore requests before loading state commits", async () => {
    const firstAccommodation = createAccommodation(1);
    const secondAccommodation = createAccommodation(2);
    const loadMoreRequest = deferred<HostAccommodationInfos>();

    jest
      .mocked(accommodationApi.getMyAccommodations)
      .mockResolvedValueOnce(
        createAccommodationPage([firstAccommodation], "cursor-1")
      )
      .mockReturnValueOnce(loadMoreRequest.promise)
      .mockResolvedValue(createAccommodationPage([createAccommodation(3)]));

    const { result } = renderHook(() => useHostListings("PUBLISHED"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    let firstLoadMore!: Promise<void>;
    let secondLoadMore!: Promise<void>;
    await act(async () => {
      firstLoadMore = result.current.loadMore();
      secondLoadMore = result.current.loadMore();
    });

    expect(accommodationApi.getMyAccommodations).toHaveBeenCalledTimes(2);

    await act(async () => {
      loadMoreRequest.resolve(createAccommodationPage([secondAccommodation]));
      await firstLoadMore;
      await secondLoadMore;
    });

    await waitFor(() =>
      expect(result.current.accommodations).toEqual([
        firstAccommodation,
        secondAccommodation,
      ])
    );
  });
});
