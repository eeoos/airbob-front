import { act, renderHook } from "@testing-library/react";
import { useSearchBarPopoverState } from "./useSearchBarPopoverState";

describe("useSearchBarPopoverState", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("opens the date picker and closes the guest picker", () => {
    const onExpandedChange = jest.fn();
    const { result } = renderHook(() =>
      useSearchBarPopoverState({
        onExpandedChange,
        checkIn: null,
        checkOut: null,
        completeCheckoutIfNeeded: jest.fn(),
      }),
    );

    act(() => {
      result.current.openDatePicker();
    });

    expect(result.current.isExpanded).toBe(true);
    expect(result.current.showDatePicker).toBe(true);
    expect(result.current.showGuestPicker).toBe(false);
    expect(result.current.isOpeningDatePicker).toBe(true);
    expect(onExpandedChange).toHaveBeenCalledWith(true);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isOpeningDatePicker).toBe(false);
  });

  it("toggles the guest picker while closing the date picker", () => {
    const { result } = renderHook(() =>
      useSearchBarPopoverState({
        checkIn: null,
        checkOut: null,
        completeCheckoutIfNeeded: jest.fn(),
      }),
    );

    act(() => {
      result.current.openDatePicker();
      result.current.toggleGuestPicker();
    });

    expect(result.current.showDatePicker).toBe(false);
    expect(result.current.showGuestPicker).toBe(true);
    expect(result.current.isOpeningGuestPicker).toBe(true);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isOpeningGuestPicker).toBe(false);
  });

  it("closes transient panels and completes an unfinished checkout", () => {
    const completeCheckoutIfNeeded = jest.fn();
    const { result } = renderHook(() =>
      useSearchBarPopoverState({
        checkIn: new Date(2026, 6, 10),
        checkOut: null,
        completeCheckoutIfNeeded,
      }),
    );

    act(() => {
      result.current.openDatePicker();
      result.current.setShowSuggestions(true);
    });

    act(() => {
      result.current.closeTransientPanels({
        collapseWhenDateSelected: true,
      });
    });

    expect(completeCheckoutIfNeeded).toHaveBeenCalledTimes(1);
    expect(result.current.showDatePicker).toBe(false);
    expect(result.current.showGuestPicker).toBe(false);
    expect(result.current.showSuggestions).toBe(false);
    expect(result.current.isExpanded).toBe(false);
  });
});
