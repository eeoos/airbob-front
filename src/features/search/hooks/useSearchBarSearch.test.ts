import { act, renderHook } from "@testing-library/react";
import { requireDefined } from "../../../test/assertions";
import { useSearchBarSearch } from "./useSearchBarSearch";

const getFirstPushedSearch = (
  pushSearch: ReturnType<typeof vi.fn>,
): URLSearchParams => {
  const call = requireDefined(pushSearch.mock.calls[0], "pushSearch call");
  const params = requireDefined(call[0], "pushed search params");
  if (!(params instanceof URLSearchParams)) {
    throw new Error("Expected pushed search params to be URLSearchParams");
  }
  return params;
};

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
  pushSearch: vi.fn(),
  closeTransientPanels: vi.fn(),
  isPlacesLoading: false,
});

describe("useSearchBarSearch", () => {
  it("closes transient panels and sends selected-place search to onSearch", () => {
    const options = createOptions();
    const onSearch = vi.fn();
    const stopPropagation = vi.fn();
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
    expect(options.pushSearch).not.toHaveBeenCalled();
  });

  it("navigates with search params and removes the stale page when onSearch is absent", () => {
    const options = createOptions();
    const { result } = renderHook(() => useSearchBarSearch(options));

    act(() => {
      result.current();
    });

    expect(options.pushSearch).toHaveBeenCalledTimes(1);
    expect(getFirstPushedSearch(options.pushSearch).toString()).toBe(
      "destination=Seoul&lat=37.5665&lng=126.978&topLeftLat=37.7&topLeftLng=126.8&bottomRightLat=37.4&bottomRightLng=127.1&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=0",
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

    expect(options.pushSearch).toHaveBeenCalledTimes(1);
    expect(getFirstPushedSearch(options.pushSearch).toString()).toBe(
      "destination=Seoul&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=0",
    );
  });

  it("does not submit while place details are still loading", () => {
    const options = createOptions();
    options.isPlacesLoading = true;
    const { result } = renderHook(() => useSearchBarSearch(options));

    act(() => {
      result.current();
    });

    expect(options.pushSearch).not.toHaveBeenCalled();
    expect(options.closeTransientPanels).not.toHaveBeenCalled();
  });

  it("does not push the same search target twice", () => {
    const options = createOptions();
    const { result } = renderHook(() => useSearchBarSearch(options));

    act(() => {
      result.current();
      result.current();
    });

    expect(options.pushSearch).toHaveBeenCalledTimes(1);
    expect(options.closeTransientPanels).toHaveBeenCalledTimes(1);
  });
});
