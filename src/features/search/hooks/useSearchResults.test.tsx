import { act, renderHook, waitFor } from "@testing-library/react";
import { accommodationApi } from "../../../api";
import {
  AccommodationSearchInfo,
  AccommodationSearchResponse,
} from "../../../types/accommodation";
import { useSearchResults } from "./useSearchResults";

jest.mock("../../../api", () => ({
  accommodationApi: {
    search: jest.fn(),
  },
}));

const mockSetSearchParams = jest.fn();
const mockHandleError = jest.fn();
const mockClearError = jest.fn();
const mockSetIsMapDragMode = jest.fn();
const mockRequestMapBoundsUpdate = jest.fn();

const createAccommodation = (id: number): AccommodationSearchInfo =>
  ({
    id,
    name: `숙소 ${id}`,
    accommodation_thumbnail_url: null,
    base_price: 100000,
    currency: "KRW",
    type: "APARTMENT",
    address_summary: {
      country: "KR",
      state: null,
      city: "Seoul",
      district: null,
    },
    coordinate: {
      latitude: 37.5 + id,
      longitude: 127 + id,
    },
    review_summary: {
      total_count: 0,
      average_rating: 0,
    },
    is_in_wishlist: false,
  });

const createSearchResponse = (
  page: number,
  totalPages: number,
  totalElements: number,
  accommodations: AccommodationSearchInfo[] = [createAccommodation(page + 1)]
): AccommodationSearchResponse => ({
  stay_search_result_listing: accommodations,
  page_info: {
    page_size: 18,
    current_page: page,
    total_pages: totalPages,
    total_elements: totalElements,
    is_first: page === 0,
    is_last: page === totalPages - 1,
    has_next: page < totalPages - 1,
    has_previous: page > 0,
  },
});

const renderUseSearchResults = (initialParams: URLSearchParams) =>
  renderHook(
    ({ searchParams }) =>
      useSearchResults({
        searchParams,
        setSearchParams: mockSetSearchParams,
        handleError: mockHandleError,
        clearError: mockClearError,
        setIsMapDragMode: mockSetIsMapDragMode,
        requestMapBoundsUpdate: mockRequestMapBoundsUpdate,
      }),
    { initialProps: { searchParams: initialParams } }
  );

describe("useSearchResults", () => {
  beforeEach(() => {
    mockSetSearchParams.mockReset();
    mockHandleError.mockReset();
    mockClearError.mockReset();
    mockSetIsMapDragMode.mockReset();
    mockRequestMapBoundsUpdate.mockReset();
    jest.mocked(accommodationApi.search).mockReset();
    window.scrollTo = jest.fn();
  });

  it("fetches the first result set from URL query params", async () => {
    const response = createSearchResponse(0, 30, 42);
    jest.mocked(accommodationApi.search).mockResolvedValue(response);

    const { result } = renderUseSearchResults(
      new URLSearchParams("destination=Seoul&adultOccupancy=2")
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(accommodationApi.search).toHaveBeenCalledTimes(1);
    expect(accommodationApi.search).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: "Seoul",
        page: 0,
        size: 18,
        adultOccupancy: 2,
      })
    );
    expect(result.current.accommodations).toEqual(
      response.stay_search_result_listing
    );
    expect(result.current.currentPage).toBe(0);
    expect(result.current.totalPages).toBe(15);
    expect(result.current.totalElements).toBe(42);
    expect(mockSetIsMapDragMode).toHaveBeenLastCalledWith(false);
  });

  it("fetches a clicked page once and suppresses the matching URL effect fetch", async () => {
    jest
      .mocked(accommodationApi.search)
      .mockResolvedValueOnce(createSearchResponse(0, 5, 50))
      .mockResolvedValueOnce(createSearchResponse(1, 5, 50));

    const { result, rerender } = renderUseSearchResults(
      new URLSearchParams("destination=Seoul")
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    jest.mocked(accommodationApi.search).mockClear();

    await act(async () => {
      await result.current.handlePageChange(1);
    });

    expect(accommodationApi.search).toHaveBeenCalledTimes(1);
    expect(accommodationApi.search).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: "Seoul",
        page: 1,
      })
    );
    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    const nextParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(nextParams.get("page")).toBe("1");
    expect(mockSetSearchParams.mock.calls[0][1]).toEqual({ replace: false });

    rerender({ searchParams: nextParams });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(accommodationApi.search).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });

  it("removes a stale destination page before fetching and ignores the old query rerun", async () => {
    jest.mocked(accommodationApi.search).mockResolvedValue(
      createSearchResponse(0, 5, 50)
    );
    const staleParams = new URLSearchParams(
      "destination=Seoul&page=2&adultOccupancy=1"
    );

    const { result, rerender } = renderUseSearchResults(staleParams);

    await waitFor(() => expect(mockSetSearchParams).toHaveBeenCalledTimes(1));

    expect(accommodationApi.search).not.toHaveBeenCalled();
    const resetParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(resetParams.toString()).toBe("destination=Seoul&adultOccupancy=1");
    expect(mockSetSearchParams.mock.calls[0][1]).toEqual({ replace: true });

    rerender({
      searchParams: new URLSearchParams(
        "destination=Seoul&page=2&adultOccupancy=1"
      ),
    });
    expect(accommodationApi.search).not.toHaveBeenCalled();

    rerender({ searchParams: resetParams });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(accommodationApi.search).toHaveBeenCalledTimes(1);
    expect(accommodationApi.search).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: "Seoul",
        adultOccupancy: 1,
        page: 0,
      })
    );
  });

  it("updates URL bounds and fetches viewport results as map-drag mode", async () => {
    jest
      .mocked(accommodationApi.search)
      .mockResolvedValueOnce(createSearchResponse(0, 5, 50))
      .mockResolvedValueOnce(createSearchResponse(0, 3, 12));

    const { result, rerender } = renderUseSearchResults(
      new URLSearchParams("destination=Seoul")
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    jest.mocked(accommodationApi.search).mockClear();
    mockSetIsMapDragMode.mockClear();

    act(() => {
      result.current.handleMapBoundsChange({
        north: 38,
        south: 37,
        east: 128,
        west: 126,
      });
    });

    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    const boundsParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(boundsParams.has("destination")).toBe(false);
    expect(boundsParams.has("page")).toBe(false);
    expect(boundsParams.get("topLeftLat")).toBe("38");
    expect(mockSetSearchParams.mock.calls[0][1]).toEqual({ replace: true });

    rerender({ searchParams: boundsParams });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(accommodationApi.search).toHaveBeenCalledTimes(1);
    expect(accommodationApi.search).toHaveBeenCalledWith(
      expect.objectContaining({
        topLeftLat: 38,
        topLeftLng: 126,
        bottomRightLat: 37,
        bottomRightLng: 128,
        destination: undefined,
        page: 0,
      })
    );
    expect(mockSetIsMapDragMode).toHaveBeenLastCalledWith(true);
    expect(mockRequestMapBoundsUpdate).toHaveBeenCalled();
  });

  it("routes API errors through the provided handler and stops loading", async () => {
    const error = new Error("search failed");
    jest.mocked(accommodationApi.search).mockRejectedValue(error);

    const { result } = renderUseSearchResults(
      new URLSearchParams("destination=Seoul")
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockHandleError).toHaveBeenCalledWith(error);
    expect(result.current.accommodations).toEqual([]);
  });
});
