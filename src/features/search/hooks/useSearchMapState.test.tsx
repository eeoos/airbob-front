import { act, renderHook } from "@testing-library/react";
import { AccommodationSearchInfo } from "../../../types/accommodation";
import { useSearchMapState } from "./useSearchMapState";

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
      latitude: 37.5,
      longitude: 127,
    },
    review_summary: {
      total_count: 0,
      average_rating: 0,
    },
    is_in_wishlist: false,
  });

describe("useSearchMapState", () => {
  it("tracks selected and hovered accommodations for list/map sync", () => {
    const scrollIntoView = jest.fn();
    const element = document.createElement("div");
    element.id = "accommodation-10";
    element.scrollIntoView = scrollIntoView;
    document.body.appendChild(element);

    const { result } = renderHook(() => useSearchMapState());

    act(() => {
      result.current.setHoveredAccommodationId(10);
      result.current.handleAccommodationSelect(createAccommodation(10));
    });

    expect(result.current.hoveredAccommodationId).toBe(10);
    expect(result.current.selectedAccommodationId).toBe(10);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });

    act(() => {
      result.current.handleAccommodationSelect(null);
      result.current.setHoveredAccommodationId(null);
    });

    expect(result.current.selectedAccommodationId).toBeNull();
    expect(result.current.hoveredAccommodationId).toBeNull();

    document.body.removeChild(element);
  });

  it("tracks expanded map, drag mode, and pending bounds updates", () => {
    const { result } = renderHook(() => useSearchMapState());

    expect(result.current.isMapExpanded).toBe(false);
    expect(result.current.isMapDragMode).toBe(false);
    expect(result.current.shouldUpdateMapBounds).toBe(false);

    act(() => {
      result.current.toggleMapExpanded();
      result.current.setIsMapDragMode(true);
      result.current.requestMapBoundsUpdate();
    });

    expect(result.current.isMapExpanded).toBe(true);
    expect(result.current.isMapDragMode).toBe(true);
    expect(result.current.shouldUpdateMapBounds).toBe(true);

    act(() => {
      result.current.onMapBoundsUpdated();
    });

    expect(result.current.shouldUpdateMapBounds).toBe(false);
  });

  it("selects an accommodation id without requiring a full accommodation object", () => {
    const { result } = renderHook(() => useSearchMapState());

    act(() => {
      result.current.selectAccommodationId(25);
    });

    expect(result.current.selectedAccommodationId).toBe(25);
  });
});
