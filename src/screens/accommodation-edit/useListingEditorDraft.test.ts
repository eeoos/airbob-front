import { act, renderHook } from "@testing-library/react";
import type { ListingEditorAccommodation } from "../../features/accommodations/listing-editor/model/listingEditor";
import { useListingEditorDraft } from "./useListingEditorDraft";

const accommodation: ListingEditorAccommodation = {
  id: 3,
  name: "기존 숙소",
  description: "기존 설명",
  type: "ENTIRE_PLACE",
  basePrice: 120_000,
  currency: "KRW",
  checkInTime: "15:00:00",
  checkOutTime: "11:00:00",
  address: {
    postalCode: "12345",
    country: "대한민국",
    state: "서울특별시",
    city: "서울특별시",
    district: "마포구",
    street: "월드컵로 1",
    detail: "101호",
  },
  occupancyPolicy: {
    maxOccupancy: 4,
    infantOccupancy: 1,
    petOccupancy: 0,
  },
  amenities: [{ name: "WIFI", count: 1 }],
  images: [],
};

describe("useListingEditorDraft", () => {
  it("keeps the working draft separate from the committed server baseline", () => {
    const { result } = renderHook(() => useListingEditorDraft());

    act(() => result.current.hydrate(accommodation));
    act(() => result.current.changeField("name", "변경한 숙소"));

    expect(result.current.capturePersistence()).toMatchObject({
      update: { name: "변경한 숙소" },
    });

    act(() =>
      result.current.commitBaseline({
        ...accommodation,
        name: "변경한 숙소",
      }),
    );

    expect(result.current.formData.name).toBe("변경한 숙소");
    expect(result.current.capturePersistence()?.update).toEqual({});
  });

  it("preserves edits made after a captured save while advancing the baseline", () => {
    const { result } = renderHook(() => useListingEditorDraft());

    act(() => result.current.hydrate(accommodation));
    act(() => result.current.changeField("name", "전송한 값"));
    const captured = result.current.capturePersistence();
    act(() => result.current.changeField("name", "추가 변경"));
    act(() =>
      result.current.commitBaseline({ ...accommodation, name: "전송한 값" }),
    );

    expect(captured?.update).toEqual({ name: "전송한 값" });
    expect(result.current.formData.name).toBe("추가 변경");
    expect(result.current.capturePersistence()?.update).toEqual({
      name: "추가 변경",
    });
  });

  it("keeps null-source defaults pending until a form update commits them", () => {
    const nullableSource: ListingEditorAccommodation = {
      ...accommodation,
      checkInTime: null,
      checkOutTime: null,
      occupancyPolicy: null,
    };
    const { result } = renderHook(() => useListingEditorDraft());

    act(() => result.current.hydrate(nullableSource));

    const expectedDefaults = {
      checkInTime: "15:00",
      checkOutTime: "11:00",
      occupancyPolicy: {
        maxOccupancy: 1,
        infantOccupancy: 0,
        petOccupancy: 0,
      },
    };
    expect(result.current.capturePersistence()?.update).toEqual(
      expectedDefaults,
    );

    act(() =>
      result.current.commitBaseline({
        ...nullableSource,
        images: [{ id: 32, imageUrl: "/new-room.jpg" }],
      }),
    );
    expect(result.current.capturePersistence()?.update).toEqual(
      expectedDefaults,
    );

    act(() =>
      result.current.commitBaseline({
        ...nullableSource,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        occupancyPolicy: {
          maxOccupancy: 1,
          infantOccupancy: 0,
          petOccupancy: 0,
        },
      }),
    );
    expect(result.current.capturePersistence()?.update).toEqual({});
  });

  it("applies rapid count and time commands against the latest draft", () => {
    const { result } = renderHook(() => useListingEditorDraft());
    act(() => result.current.hydrate(accommodation));

    act(() => {
      result.current.incrementGuest();
      result.current.incrementGuest();
      result.current.incrementAmenity("WIFI");
      result.current.incrementAmenity("WIFI");
      result.current.selectTimeValue("checkIn", { unit: "hour", value: 4 });
      result.current.selectTimeValue("checkIn", {
        unit: "minute",
        value: 30,
      });
    });

    expect(result.current.formData.occupancyPolicyInfo.maxOccupancy).toBe("6");
    expect(result.current.formData.amenityInfos).toEqual([
      { name: "WIFI", count: 3 },
    ]);
    expect(result.current.formData.checkInTime).toBe("16:30");

    act(() => {
      result.current.decrementGuest();
      result.current.decrementGuest();
      result.current.decrementAmenity("WIFI");
      result.current.decrementAmenity("WIFI");
    });

    expect(result.current.formData.occupancyPolicyInfo.maxOccupancy).toBe("4");
    expect(result.current.formData.amenityInfos).toEqual([
      { name: "WIFI", count: 1 },
    ]);
  });

  it("rejects invalid semantic command inputs without mutating the draft", () => {
    const { result } = renderHook(() => useListingEditorDraft());
    act(() => result.current.hydrate(accommodation));
    const before = result.current.formData;

    act(() => {
      result.current.changeField("unknown" as never, "ignored");
      result.current.changeOccupancy("unknown" as never, true);
      result.current.toggleAmenity("   ");
      result.current.incrementAmenity("UNKNOWN");
      result.current.decrementAmenity("UNKNOWN");
      result.current.removeAmenity("UNKNOWN");
      result.current.openTimePickerCommand("unknown" as never);
      result.current.selectTimeValue("checkIn", { unit: "hour", value: 0 });
      result.current.selectTimeValue("checkOut", {
        unit: "minute",
        value: 60,
      });
      result.current.selectTimeValue("checkIn", {
        unit: "period",
        value: "invalid" as never,
      });
    });

    expect(result.current.formData).toBe(before);
    expect(result.current.openTimePicker).toBeNull();
    expect(result.current.selectAccommodationType("UNKNOWN")).toBe(false);
    expect(result.current.formData).toBe(before);
  });

  it("opens and reopens time pickers without changing unrelated draft fields", () => {
    const { result } = renderHook(() => useListingEditorDraft());
    act(() => result.current.hydrate(accommodation));
    const before = result.current.formData;

    act(() => result.current.openTimePickerCommand("checkIn"));
    expect(result.current.openTimePicker).toBe("checkIn");
    act(() => result.current.closeTimePicker());
    act(() => result.current.openTimePickerCommand("checkOut"));

    expect(result.current.openTimePicker).toBe("checkOut");
    expect(result.current.formData).toBe(before);
  });
});
