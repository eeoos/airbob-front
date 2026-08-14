import { act, renderHook } from "@testing-library/react";
import { useSearchBarSearch } from "./useSearchBarSearch";

const createOptions = () => ({
  inputText: "Seoul",
  selectedPlace: {
    lat: 37.5665,
    lng: 126.978,
    viewport: {
      north: 37.7,
      south: 37.4,
      east: 127.1,
      west: 126.8,
    },
  },
  checkIn: null,
  checkOut: null,
  adultOccupancy: 2,
  childOccupancy: 1,
  infantOccupancy: 0,
  petOccupancy: 0,
  urlSearchParams: new URLSearchParams("page=3&destination=Busan"),
  navigate: jest.fn(),
  closeTransientPanels: jest.fn(),
  isPlacesLoading: false,
});

describe("useSearchBarSearch", () => {
  it("closes transient panels and sends selected-place search to onSearch", () => {
    const options = createOptions();
    const onSearch = jest.fn();
    const stopPropagation = jest.fn();
    const { result } = renderHook(() =>
      useSearchBarSearch({ ...options, onSearch }),
    );

    act(() => {
      result.current({ stopPropagation });
    });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(options.closeTransientPanels).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith({
      destination: "Seoul",
      lat: 37.5665,
      lng: 126.978,
      viewport: options.selectedPlace.viewport,
      checkIn: undefined,
      checkOut: undefined,
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 0,
      petOccupancy: 0,
    });
    expect(options.navigate).not.toHaveBeenCalled();
  });

  it("navigates with search params and removes the stale page when onSearch is absent", () => {
    const options = createOptions();
    const { result } = renderHook(() => useSearchBarSearch(options));

    act(() => {
      result.current();
    });

    expect(options.navigate).toHaveBeenCalledWith(
      "/search?destination=Seoul&lat=37.5665&lng=126.978&topLeftLat=37.7&topLeftLng=126.8&bottomRightLat=37.4&bottomRightLng=127.1&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=0",
    );
  });

  it("ignores an invalid selected place and navigates as a text search", () => {
    const options = createOptions();
    options.selectedPlace = {
      ...options.selectedPlace,
      lat: Number.NaN,
    };
    const { result } = renderHook(() => useSearchBarSearch(options));

    act(() => {
      result.current();
    });

    expect(options.navigate).toHaveBeenCalledWith(
      "/search?destination=Seoul&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=0",
    );
  });

  it("does not submit while place details are still loading", () => {
    const options = createOptions();
    options.isPlacesLoading = true;
    const { result } = renderHook(() => useSearchBarSearch(options));

    act(() => {
      result.current();
    });

    expect(options.navigate).not.toHaveBeenCalled();
    expect(options.closeTransientPanels).not.toHaveBeenCalled();
  });

  it("does not push the same search target twice", () => {
    const options = createOptions();
    const { result } = renderHook(() => useSearchBarSearch(options));

    act(() => {
      result.current();
      result.current();
    });

    expect(options.navigate).toHaveBeenCalledTimes(1);
    expect(options.closeTransientPanels).toHaveBeenCalledTimes(1);
  });
});
