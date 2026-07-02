import { act, renderHook, waitFor } from "@testing-library/react";
import { accommodationApi } from "../../../api";
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

const createAccommodation = (id: number, status = AccommodationStatus.PUBLISHED) =>
  ({
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
  } as any);

describe("useHostListings", () => {
  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockReset();
    jest.mocked(accommodationApi.getMyAccommodations).mockReset();
  });

  it("loads the first host listing page for the selected status", async () => {
    const accommodation = createAccommodation(1);
    jest.mocked(accommodationApi.getMyAccommodations).mockResolvedValue({
      accommodations: [accommodation],
      page_info: {
        has_next: true,
        next_cursor: "cursor-1",
      },
    } as any);

    const { result } = renderHook(() => useHostListings("PUBLISHED"));

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
      .mockResolvedValueOnce({
        accommodations: [firstAccommodation],
        page_info: {
          has_next: true,
          next_cursor: "cursor-1",
        },
      } as any)
      .mockResolvedValueOnce({
        accommodations: [secondAccommodation],
        page_info: {
          has_next: false,
          next_cursor: null,
        },
      } as any);

    const { result } = renderHook(() => useHostListings("PUBLISHED"));

    await waitFor(() => expect(result.current.hasNext).toBe(true));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(accommodationApi.getMyAccommodations).toHaveBeenLastCalledWith({
      cursor: "cursor-1",
      size: 20,
      status: AccommodationStatus.PUBLISHED,
    });
    expect(result.current.accommodations).toEqual([
      firstAccommodation,
      secondAccommodation,
    ]);
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
      .mockResolvedValueOnce({
        accommodations: [publishedAccommodation],
        page_info: {
          has_next: true,
          next_cursor: "published-cursor",
        },
      } as any)
      .mockResolvedValueOnce({
        accommodations: [draftAccommodation],
        page_info: {
          has_next: false,
          next_cursor: null,
        },
      } as any);

    const { result, rerender } = renderHook(
      ({ statusType }: { statusType: "PUBLISHED" | "DRAFT" }) =>
        useHostListings(statusType),
      {
        initialProps: {
          statusType: "PUBLISHED" as "PUBLISHED" | "DRAFT",
        },
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
      .mockResolvedValueOnce({
        accommodations: [firstAccommodation],
        page_info: {
          has_next: false,
          next_cursor: null,
        },
      } as any)
      .mockResolvedValueOnce({
        accommodations: [reloadedAccommodation],
        page_info: {
          has_next: false,
          next_cursor: null,
        },
      } as any);

    const { result } = renderHook(() => useHostListings("PUBLISHED"));

    await waitFor(() =>
      expect(result.current.accommodations).toEqual([firstAccommodation])
    );

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.accommodations).toEqual([reloadedAccommodation]);
    expect(accommodationApi.getMyAccommodations).toHaveBeenCalledTimes(2);
  });
});
