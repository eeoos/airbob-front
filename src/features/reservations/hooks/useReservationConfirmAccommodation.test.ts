import { renderHook, waitFor } from "@testing-library/react";
import { accommodationApi } from "../../../api";
import { AccommodationDetail } from "../../../types/accommodation";
import { useReservationConfirmAccommodation } from "./useReservationConfirmAccommodation";

jest.mock("../../../api", () => ({
  accommodationApi: {
    getDetail: jest.fn(),
  },
}));

const createAccommodation = (): AccommodationDetail => ({
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
    district: null,
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
});

describe("useReservationConfirmAccommodation", () => {
  beforeEach(() => {
    jest.mocked(accommodationApi.getDetail).mockReset();
  });

  it("loads the accommodation for a valid reservation confirmation", async () => {
    const accommodation = createAccommodation();
    jest.mocked(accommodationApi.getDetail).mockResolvedValue(accommodation);
    const navigate = jest.fn();
    const handleError = jest.fn();
    const clearError = jest.fn();

    const { result } = renderHook(() =>
      useReservationConfirmAccommodation({
        accommodationId: "7",
        reservationUid: "res-123",
        navigate,
        handleError,
        clearError,
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(accommodationApi.getDetail).toHaveBeenCalledWith(7);
    expect(result.current.accommodation).toEqual(accommodation);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("reports missing reservation information and returns to the detail page", async () => {
    const navigate = jest.fn();
    const handleError = jest.fn();

    const { result } = renderHook(() =>
      useReservationConfirmAccommodation({
        accommodationId: "7",
        reservationUid: null,
        navigate,
        handleError,
        clearError: jest.fn(),
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(handleError).toHaveBeenCalledWith(new Error("예약 정보가 없습니다."));
    expect(navigate).toHaveBeenCalledWith("/accommodations/7");
    expect(accommodationApi.getDetail).not.toHaveBeenCalled();
  });

  it.each(["7abc", "abc", "9007199254740992"])(
    "treats invalid accommodation id %s like a missing route id",
    async (accommodationId) => {
      const navigate = jest.fn();
      const handleError = jest.fn();
      const clearError = jest.fn();

      const { result } = renderHook(() =>
        useReservationConfirmAccommodation({
          accommodationId,
          reservationUid: "res-123",
          navigate,
          handleError,
          clearError,
        })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(navigate).toHaveBeenCalledWith("/");
      expect(accommodationApi.getDetail).not.toHaveBeenCalled();
      expect(handleError).not.toHaveBeenCalled();
      expect(clearError).not.toHaveBeenCalled();
    }
  );
});
