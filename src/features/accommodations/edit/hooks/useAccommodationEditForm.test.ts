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
    const { result } = renderHook(() => useAccommodationEditForm("3"));

    act(() => {
      result.current.loadAccommodation("3", hostDetail());
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
    const { result } = renderHook(() => useAccommodationEditForm("3"));

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
    const { result } = renderHook(() => useAccommodationEditForm("3"));

    expect(
      result.current.isStepCompleted(4, {
        imageCount: 1,
        isNewDraft: true,
      })
    ).toBe(false);

    act(() => {
      result.current.loadAccommodation("3", hostDetail());
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

  it("advances the persisted baseline with an exact successful-save snapshot", () => {
    const { result } = renderHook(() => useAccommodationEditForm("3"));

    act(() => {
      result.current.loadAccommodation("3", hostDetail());
      result.current.handleInputChange("name", "단계 저장 값");
    });

    const submittedSnapshot = result.current.formData;

    act(() => {
      result.current.commitPersistedFormData("3", submittedSnapshot, {
        name: "단계 저장 값",
      });
      result.current.handleInputChange("name", "저장 대기 중 추가 변경");
    });

    expect(result.current.initialFormData?.name).toBe("단계 저장 값");
    expect(result.current.formData.name).toBe("저장 대기 중 추가 변경");
  });

  it("does not let an old accommodation save advance the new accommodation baseline", () => {
    const { result, rerender } = renderHook(
      ({ accommodationId }) => useAccommodationEditForm(accommodationId),
      { initialProps: { accommodationId: "3" } }
    );

    act(() => {
      result.current.loadAccommodation("3", hostDetail());
    });
    const oldAccommodationSnapshot = result.current.formData;

    rerender({ accommodationId: "4" });

    act(() => {
      result.current.commitPersistedFormData("3", oldAccommodationSnapshot, {
        name: oldAccommodationSnapshot.name,
      });
    });

    expect(result.current.initialFormData).toBeNull();

    act(() => {
      result.current.loadAccommodation(
        "4",
        hostDetail({ id: 4, name: "새 경로 숙소" })
      );
    });

    expect(result.current.initialFormData?.name).toBe("새 경로 숙소");
    expect(result.current.persistedAccommodationId).toBe("4");
  });

  it("advances only fields represented by the actual PATCH payload", () => {
    const { result } = renderHook(() => useAccommodationEditForm("3"));

    act(() => {
      result.current.loadAccommodation("3", hostDetail());
    });
    const submittedSnapshot = {
      ...result.current.formData,
      name: "저장된 이름",
      addressInfo: {
        ...result.current.formData.addressInfo,
        detail: "전송되지 않은 상세 주소",
      },
    };

    act(() => {
      result.current.commitPersistedFormData("3", submittedSnapshot, {
        name: "저장된 이름",
      });
    });

    expect(result.current.initialFormData?.name).toBe("저장된 이름");
    expect(result.current.initialFormData?.addressInfo.detail).toBe("101호");
  });
});
