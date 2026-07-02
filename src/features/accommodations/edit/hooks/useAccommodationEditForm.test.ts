import { act, renderHook } from "@testing-library/react";
import { HostAccommodationDetail } from "../../../../types/accommodation";
import { useAccommodationEditForm } from "./useAccommodationEditForm";

const hostDetail = (
  overrides: Partial<HostAccommodationDetail> = {}
): HostAccommodationDetail => ({
  id: 3,
  name: "기존 숙소",
  description: "기존 설명",
  type: "ENTIRE_PLACE",
  base_price: 120000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  address: {
    postal_code: "12345",
    country: "대한민국",
    state: "서울특별시",
    city: "서울특별시",
    district: "마포구",
    street: "월드컵로 1",
    detail: "101호",
  },
  coordinate: { latitude: 37.5, longitude: 127 },
  host: { id: 301, nickname: "Test Host", thumbnail_image_url: null },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 0,
  },
  amenities: [
    { type: "WIFI", count: 1 },
    { type: "TV", count: 2 },
  ],
  images: [],
  review_summary: { total_count: 0, average_rating: 0 },
  ...overrides,
});

describe("useAccommodationEditForm", () => {
  it("loads host detail into form state, initial state, and selected amenities", () => {
    const { result } = renderHook(() => useAccommodationEditForm());

    act(() => {
      result.current.loadAccommodation(hostDetail());
    });

    expect(result.current.formData).toMatchObject({
      name: "기존 숙소",
      basePrice: "120000",
      type: "ENTIRE_PLACE",
      addressInfo: {
        street: "월드컵로 1",
        detail: "101호",
      },
      occupancyPolicyInfo: {
        maxOccupancy: "4",
        infantOccupancy: true,
        petOccupancy: false,
      },
    });
    expect(result.current.initialFormData).toEqual(result.current.formData);
    expect(Array.from(result.current.selectedAmenities).sort()).toEqual([
      "TV",
      "WIFI",
    ]);
  });

  it("updates flat, nested, and time fields through stable handlers", () => {
    const { result } = renderHook(() => useAccommodationEditForm());

    act(() => {
      result.current.handleInputChange("name", "새 숙소");
      result.current.handleNestedChange("addressInfo", "detail", "202호");
      result.current.handleNestedChange(
        "occupancyPolicyInfo",
        "maxOccupancy",
        "5"
      );
      result.current.handleTimeChange("checkIn", 4, 30, "PM");
    });

    expect(result.current.formData.name).toBe("새 숙소");
    expect(result.current.formData.addressInfo.detail).toBe("202호");
    expect(result.current.formData.occupancyPolicyInfo.maxOccupancy).toBe("5");
    expect(result.current.formData.checkInTime).toBe("16:30");
  });

  it("calculates wizard completion with draft step gating", () => {
    const { result } = renderHook(() => useAccommodationEditForm());

    expect(
      result.current.isStepCompleted(4, {
        imageCount: 1,
        isNewDraft: true,
      })
    ).toBe(false);

    act(() => {
      result.current.loadAccommodation(hostDetail());
    });

    expect(
      result.current.isStepCompleted(1, {
        imageCount: 1,
        isNewDraft: true,
      })
    ).toBe(true);
    expect(
      result.current.isStepCompleted(4, {
        imageCount: 1,
        isNewDraft: true,
      })
    ).toBe(true);
    expect(
      result.current.canProceedToNext(4, {
        imageCount: 1,
        isNewDraft: true,
      })
    ).toBe(true);
  });
});
