import { renderHook } from "@testing-library/react";
import { useSearchBarUrlSync } from "./useSearchBarUrlSync";

describe("useSearchBarUrlSync", () => {
  it("applies destination, dates, and guest counts from URL params", () => {
    const resetPlaces = jest.fn();
    const handleInputChange = jest.fn();
    const setDateRange = jest.fn();
    const setGuestCounts = jest.fn();

    renderHook(() =>
      useSearchBarUrlSync({
        urlSearchParams: new URLSearchParams(
          "destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=1&petOccupancy=1",
        ),
        resetPlaces,
        handleInputChange,
        setDateRange,
        setGuestCounts,
      }),
    );

    expect(resetPlaces).toHaveBeenCalledTimes(1);
    expect(handleInputChange).toHaveBeenCalledWith("Seoul");
    expect(setDateRange).toHaveBeenCalledWith(
      new Date(2026, 6, 10),
      new Date(2026, 6, 12),
    );
    expect(setGuestCounts).toHaveBeenCalledWith({
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 1,
      petOccupancy: 1,
    });
  });

  it("does not reset the destination when unrelated params change", () => {
    const resetPlaces = jest.fn();
    const handleInputChange = jest.fn();
    const setDateRange = jest.fn();
    const setGuestCounts = jest.fn();
    const { rerender } = renderHook(
      ({ urlSearchParams }: { urlSearchParams: URLSearchParams }) =>
        useSearchBarUrlSync({
          urlSearchParams,
          resetPlaces,
          handleInputChange,
          setDateRange,
          setGuestCounts,
        }),
      {
        initialProps: {
          urlSearchParams: new URLSearchParams("destination=Seoul"),
        },
      },
    );

    resetPlaces.mockClear();
    handleInputChange.mockClear();

    rerender({
      urlSearchParams: new URLSearchParams("destination=Seoul&page=2"),
    });

    expect(resetPlaces).not.toHaveBeenCalled();
    expect(handleInputChange).not.toHaveBeenCalled();
  });
});
