import { renderHook, waitFor } from "@testing-library/react";
import { accommodationApi } from "../../../../api";
import { HostAccommodationDetail } from "../../../../types/accommodation";
import { useAccommodationEditDetail } from "./useAccommodationEditDetail";

jest.mock("../../../../api", () => ({
  accommodationApi: {
    getHostAccommodationDetail: jest.fn(),
  },
}));

const hostAccommodation: HostAccommodationDetail = {
  id: 3,
  name: "테스트 숙소",
  description: "설명",
  type: "ENTIRE_PLACE",
  base_price: 100000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  address: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: null,
    street: "테스트로",
    detail: null,
    postal_code: "12345",
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
  images: [{ id: 11, image_url: "/room.jpg" }],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
};

describe("useAccommodationEditDetail", () => {
  beforeEach(() => {
    jest.mocked(accommodationApi.getHostAccommodationDetail).mockReset();
  });

  it("loads existing host detail in edit mode", async () => {
    const loadAccommodation = jest.fn();
    const loadImages = jest.fn();
    const handleError = jest.fn();
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(hostAccommodation);

    renderHook(() =>
      useAccommodationEditDetail({
        accommodationId: "3",
        isNewDraft: false,
        loadAccommodation,
        loadImages,
        handleError,
      })
    );

    await waitFor(() =>
      expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledWith(3)
    );
    expect(loadAccommodation).toHaveBeenCalledWith(hostAccommodation);
    expect(loadImages).toHaveBeenCalledWith(hostAccommodation.images);
    expect(handleError).not.toHaveBeenCalled();
  });

  it("skips loading for newly created drafts", () => {
    renderHook(() =>
      useAccommodationEditDetail({
        accommodationId: "3",
        isNewDraft: true,
        loadAccommodation: jest.fn(),
        loadImages: jest.fn(),
        handleError: jest.fn(),
      })
    );

    expect(accommodationApi.getHostAccommodationDetail).not.toHaveBeenCalled();
  });
});
