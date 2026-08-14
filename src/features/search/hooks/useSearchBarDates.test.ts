import { act, renderHook } from "@testing-library/react";
import { useSearchBarDates } from "./useSearchBarDates";

const dateKey = (date: Date | null) =>
  date ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : null;

describe("useSearchBarDates", () => {
  it("normalizes reversed date selections", () => {
    const { result } = renderHook(() => useSearchBarDates());

    act(() => {
      result.current.handleDateSelect(
        new Date(2026, 6, 12),
        new Date(2026, 6, 10),
      );
    });

    expect(dateKey(result.current.checkIn)).toBe("2026-7-10");
    expect(dateKey(result.current.checkOut)).toBe("2026-7-12");
  });

  it("completes checkout on the day after a check-in when needed", () => {
    const { result } = renderHook(() => useSearchBarDates());

    act(() => {
      result.current.setDateRange(new Date(2026, 6, 10), null);
    });
    act(() => {
      result.current.completeCheckoutIfNeeded();
    });

    expect(dateKey(result.current.checkIn)).toBe("2026-7-10");
    expect(dateKey(result.current.checkOut)).toBe("2026-7-11");
  });
});
