import { act, renderHook, waitFor } from "@testing-library/react";
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

describe("useAccommodationDetail", () => {
  beforeEach(() => {
    mockHandleError.mockReset();
    mockClearError.mockReset();
    jest.mocked(accommodationApi.getDetail).mockReset();
    jest.mocked(recentlyViewedApi.add).mockReset();
  });

  it("loads accommodation detail and records recently viewed for authenticated users", async () => {
    const accommodation = createAccommodation();
    jest.mocked(accommodationApi.getDetail).mockResolvedValue(accommodation);
    jest.mocked(recentlyViewedApi.add).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAccommodationDetail({
        accommodationId: "7",
        isAuthenticated: true,
        handleError: mockHandleError,
        clearError: mockClearError,
      })
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

    const { result } = renderHook(() =>
      useAccommodationDetail({
        accommodationId: "7",
        isAuthenticated: false,
        handleError: mockHandleError,
        clearError: mockClearError,
      })
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

    const { result } = renderHook(() =>
      useAccommodationDetail({
        accommodationId: "7",
        isAuthenticated: false,
        handleError: mockHandleError,
        clearError: mockClearError,
      })
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
});
