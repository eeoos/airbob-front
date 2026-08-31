import { renderHook } from "@testing-library/react";
import { useSearchBarUrlSync } from "./useSearchBarUrlSync";

describe("useSearchBarUrlSync", () => {
  it("applies destination, dates, and guest counts from URL params", () => {
    const resetPlaces = vi.fn();
    const syncAutocompleteInput = vi.fn();
    const onCommittedChanged = vi.fn();

    renderHook(() =>
      useSearchBarUrlSync({
        urlSearchParams: new URLSearchParams(
          "destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=1&petOccupancy=1",
        ),
        resetPlaces,
        syncAutocompleteInput,
        onCommittedChanged,
      }),
    );

    expect(resetPlaces).toHaveBeenCalledTimes(1);
    expect(syncAutocompleteInput).toHaveBeenCalledWith("Seoul");
    expect(onCommittedChanged).toHaveBeenCalledWith({
      destination: "Seoul",
      checkIn: new Date(2026, 6, 10),
      checkOut: new Date(2026, 6, 12),
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 1,
      petOccupancy: 1,
    });
  });

  it("does not reset the destination when unrelated params change", () => {
    const resetPlaces = vi.fn();
    const syncAutocompleteInput = vi.fn();
    const onCommittedChanged = vi.fn();
    const { rerender } = renderHook(
      ({ urlSearchParams }: { urlSearchParams: URLSearchParams }) =>
        useSearchBarUrlSync({
          urlSearchParams,
          resetPlaces,
          syncAutocompleteInput,
          onCommittedChanged,
        }),
      {
        initialProps: {
          urlSearchParams: new URLSearchParams("destination=Seoul"),
        },
      },
    );

    resetPlaces.mockClear();
    syncAutocompleteInput.mockClear();
    onCommittedChanged.mockClear();

    rerender({
      urlSearchParams: new URLSearchParams("destination=Seoul&page=2"),
    });

    expect(resetPlaces).not.toHaveBeenCalled();
    expect(syncAutocompleteInput).not.toHaveBeenCalled();
    expect(onCommittedChanged).not.toHaveBeenCalled();
  });

  it("hydrates the whole draft once when a committed field changes", () => {
    const onCommittedChanged = vi.fn();
    const { rerender } = renderHook(
      ({ urlSearchParams }: { urlSearchParams: URLSearchParams }) =>
        useSearchBarUrlSync({
          urlSearchParams,
          resetPlaces: vi.fn(),
          syncAutocompleteInput: vi.fn(),
          onCommittedChanged,
        }),
      {
        initialProps: {
          urlSearchParams: new URLSearchParams(
            "destination=Seoul&adultOccupancy=1",
          ),
        },
      },
    );

    onCommittedChanged.mockClear();
    rerender({
      urlSearchParams: new URLSearchParams(
        "destination=Seoul&adultOccupancy=3",
      ),
    });

    expect(onCommittedChanged).toHaveBeenCalledTimes(1);
    expect(onCommittedChanged).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "Seoul", adultOccupancy: 3 }),
    );
  });
});
