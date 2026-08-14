import { act, renderHook } from "@testing-library/react";
import { useSearchBarGuests } from "./useSearchBarGuests";

describe("useSearchBarGuests", () => {
  it("clamps each guest count to its minimum", () => {
    const { result } = renderHook(() => useSearchBarGuests());

    act(() => {
      result.current.setAdultOccupancy(0);
      result.current.setChildOccupancy(-1);
      result.current.setInfantOccupancy(-1);
      result.current.setPetOccupancy(-1);
    });

    expect(result.current.adultOccupancy).toBe(1);
    expect(result.current.childOccupancy).toBe(0);
    expect(result.current.infantOccupancy).toBe(0);
    expect(result.current.petOccupancy).toBe(0);
  });

  it("supports functional updates and calculates total guests", () => {
    const { result } = renderHook(() => useSearchBarGuests());

    act(() => {
      result.current.setAdultOccupancy(2);
      result.current.setChildOccupancy(1);
      result.current.setAdultOccupancy((current) => current + 1);
    });

    expect(result.current.adultOccupancy).toBe(3);
    expect(result.current.childOccupancy).toBe(1);
    expect(result.current.getTotalGuests()).toBe(4);
  });
});
