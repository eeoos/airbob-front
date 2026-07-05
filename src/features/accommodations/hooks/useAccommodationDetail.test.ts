import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { accommodationApi, recentlyViewedApi } from "../../../api";
import { AccommodationDetail } from "../../../types/accommodation";
import { useAccommodationDetail } from "./useAccommodationDetail";

jest.mock("../../../api", () => ({
  accommodationApi: {
    getDetail: jest.fn(),
  },
  recentlyViewedApi: {
    add: jest.fn(),
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

const createAccommodation = (
  overrides: Partial<AccommodationDetail> = {}
): AccommodationDetail => ({
  id: 7,
  name: "테스트 숙소",
  description: "설명",
  type: "ENTIRE_PLACE",
  base_price: 100000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  unavailable_dates: [],
  is_in_wishlist: false,
  address_summary: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: "Mapo",
  },
  coordinate: {
    latitude: 37.5,
    longitude: 127,
  },
  host: {
    id: 1,
    nickname: "호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 1,
  },
  amenities: [],
  images: [],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
  ...overrides,
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

describe("useAccommodationDetail", () => {
  beforeEach(() => {
    mockHandleError.mockReset();
    mockClearError.mockReset();
    jest.mocked(accommodationApi.getDetail).mockReset();
    jest.mocked(recentlyViewedApi.add).mockReset();
    jest.mocked(recentlyViewedApi.add).mockResolvedValue(undefined);
  });

  it("loads accommodation detail and records recently viewed for authenticated users", async () => {
    const accommodation = createAccommodation();
    jest.mocked(accommodationApi.getDetail).mockResolvedValue(accommodation);
    jest.mocked(recentlyViewedApi.add).mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useAccommodationDetail({
          accommodationId: "7",
          isAuthenticated: true,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(recentlyViewedApi.add).toHaveBeenCalledWith(7));

    expect(accommodationApi.getDetail).toHaveBeenCalledWith(7);
    expect(result.current.accommodation).toEqual(accommodation);
    expect(mockClearError).toHaveBeenCalled();
  });

  it("routes load errors through the provided handler and stops loading", async () => {
    const error = new Error("detail failed");
    jest.mocked(accommodationApi.getDetail).mockRejectedValue(error);

    const { result } = renderHook(
      () =>
        useAccommodationDetail({
          accommodationId: "7",
          isAuthenticated: false,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockHandleError).toHaveBeenCalledWith(error);
    expect(result.current.accommodation).toBeNull();
    expect(recentlyViewedApi.add).not.toHaveBeenCalled();
  });

  it("reloads accommodation detail for wishlist reconciliation", async () => {
    jest
      .mocked(accommodationApi.getDetail)
      .mockResolvedValueOnce(createAccommodation({ is_in_wishlist: false }))
      .mockResolvedValueOnce(createAccommodation({ is_in_wishlist: true }));

    const { result } = renderHook(
      () =>
        useAccommodationDetail({
          accommodationId: "7",
          isAuthenticated: true,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.reloadAccommodation();
    });

    await waitFor(() =>
      expect(result.current.accommodation?.is_in_wishlist).toBe(true)
    );
    expect(accommodationApi.getDetail).toHaveBeenCalledTimes(2);
  });

  it("clears user-scoped wishlist state when authentication is lost", async () => {
    jest
      .mocked(accommodationApi.getDetail)
      .mockResolvedValue(createAccommodation({ is_in_wishlist: true }));

    const { result, rerender } = renderHook(
      ({ isAuthenticated }) =>
        useAccommodationDetail({
          accommodationId: "7",
          isAuthenticated,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      {
        initialProps: { isAuthenticated: true },
        wrapper: createWrapper(),
      },
    );

    await waitFor(() =>
      expect(result.current.accommodation?.is_in_wishlist).toBe(true)
    );

    rerender({ isAuthenticated: false });

    await waitFor(() =>
      expect(result.current.accommodation?.is_in_wishlist).toBe(false)
    );
  });

  it("reloads detail membership when authentication is gained", async () => {
    jest
      .mocked(accommodationApi.getDetail)
      .mockResolvedValueOnce(createAccommodation({ is_in_wishlist: false }))
      .mockResolvedValueOnce(createAccommodation({ is_in_wishlist: true }));

    const { result, rerender } = renderHook(
      ({ isAuthenticated }) =>
        useAccommodationDetail({
          accommodationId: "7",
          isAuthenticated,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      {
        initialProps: { isAuthenticated: false },
        wrapper: createWrapper(),
      },
    );

    await waitFor(() =>
      expect(result.current.accommodation?.is_in_wishlist).toBe(false)
    );

    rerender({ isAuthenticated: true });

    await waitFor(() =>
      expect(result.current.accommodation?.is_in_wishlist).toBe(true)
    );
    expect(accommodationApi.getDetail).toHaveBeenCalledTimes(2);
  });

  it("does not restore wishlist membership when an authenticated detail request resolves after logout", async () => {
    const detailRequest = createDeferred<AccommodationDetail>();
    jest.mocked(accommodationApi.getDetail).mockReturnValue(detailRequest.promise);

    const { result, rerender } = renderHook(
      ({ isAuthenticated }) =>
        useAccommodationDetail({
          accommodationId: "7",
          isAuthenticated,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      {
        initialProps: { isAuthenticated: true },
        wrapper: createWrapper(),
      },
    );

    rerender({ isAuthenticated: false });

    await act(async () => {
      detailRequest.resolve(createAccommodation({ is_in_wishlist: true }));
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.accommodation?.is_in_wishlist).toBe(false);
  });

  it("does not expose the previous accommodation while a new route id is pending", async () => {
    const nextDetailRequest = createDeferred<AccommodationDetail>();
    jest
      .mocked(accommodationApi.getDetail)
      .mockResolvedValueOnce(createAccommodation({ id: 7 }))
      .mockReturnValueOnce(nextDetailRequest.promise);

    const { result, rerender } = renderHook(
      ({ accommodationId }) =>
        useAccommodationDetail({
          accommodationId,
          isAuthenticated: true,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      {
        initialProps: { accommodationId: "7" },
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => expect(result.current.accommodation?.id).toBe(7));
    jest.mocked(recentlyViewedApi.add).mockClear();

    rerender({ accommodationId: "8" });

    await waitFor(() =>
      expect(accommodationApi.getDetail).toHaveBeenCalledWith(8)
    );
    expect(result.current.accommodation).toBeNull();
    expect(recentlyViewedApi.add).not.toHaveBeenCalled();

    await act(async () => {
      nextDetailRequest.resolve(createAccommodation({ id: 8 }));
    });

    await waitFor(() => expect(result.current.accommodation?.id).toBe(8));
    expect(recentlyViewedApi.add).toHaveBeenCalledWith(8);
  });

  it("keeps refreshed wishlist membership when an unauthenticated detail request resolves after auth reload", async () => {
    const unauthenticatedRequest = createDeferred<AccommodationDetail>();
    const authenticatedRequest = createDeferred<AccommodationDetail>();
    jest
      .mocked(accommodationApi.getDetail)
      .mockReturnValueOnce(unauthenticatedRequest.promise)
      .mockReturnValueOnce(authenticatedRequest.promise);

    const { result, rerender } = renderHook(
      ({ isAuthenticated }) =>
        useAccommodationDetail({
          accommodationId: "7",
          isAuthenticated,
          handleError: mockHandleError,
          clearError: mockClearError,
        }),
      {
        initialProps: { isAuthenticated: false },
        wrapper: createWrapper(),
      },
    );

    rerender({ isAuthenticated: true });

    await waitFor(() =>
      expect(accommodationApi.getDetail).toHaveBeenCalledTimes(2)
    );

    await act(async () => {
      authenticatedRequest.resolve(createAccommodation({ is_in_wishlist: true }));
    });

    await waitFor(() =>
      expect(result.current.accommodation?.is_in_wishlist).toBe(true)
    );

    await act(async () => {
      unauthenticatedRequest.resolve(
        createAccommodation({ is_in_wishlist: false })
      );
    });

    expect(result.current.accommodation?.is_in_wishlist).toBe(true);
    expect(accommodationApi.getDetail).toHaveBeenCalledTimes(2);
  });
});
