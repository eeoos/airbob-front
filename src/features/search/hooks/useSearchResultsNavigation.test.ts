import { act, renderHook } from "@testing-library/react";
import { useSearchResultsNavigation } from "./useSearchResultsNavigation";

describe("useSearchResultsNavigation", () => {
  it("updates map bounds and resets the previous page", () => {
    const setSearchParams = jest.fn();
    const requestMapBoundsUpdate = jest.fn();
    const setPreviousPage = jest.fn();
    const { result } = renderHook(() =>
      useSearchResultsNavigation({
        searchParams: new URLSearchParams("destination=Seoul&page=3"),
        searchParamsString: "destination=Seoul&page=3",
        currentPage: 3,
        isLoading: false,
        setSearchParams,
        requestMapBoundsUpdate,
        setPreviousPage,
      }),
    );

    act(() => {
      result.current.handleMapBoundsChange({
        north: 38,
        south: 37,
        east: 128,
        west: 126,
      });
    });

    const nextParams = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(nextParams.get("topLeftLat")).toBe("38");
    expect(nextParams.get("bottomRightLat")).toBe("37");
    expect(nextParams.has("destination")).toBe(false);
    expect(nextParams.has("page")).toBe(false);
    expect(setSearchParams.mock.calls[0][1]).toEqual({ replace: true });
    expect(setPreviousPage).toHaveBeenCalledWith(0);
  });

  it("changes pages, requests map bounds, and preserves browser history", () => {
    const setSearchParams = jest.fn();
    const requestMapBoundsUpdate = jest.fn();
    const setPreviousPage = jest.fn();
    const { result } = renderHook(() =>
      useSearchResultsNavigation({
        searchParams: new URLSearchParams("destination=Seoul"),
        searchParamsString: "destination=Seoul",
        currentPage: 0,
        isLoading: false,
        setSearchParams,
        requestMapBoundsUpdate,
        setPreviousPage,
      }),
    );

    act(() => {
      result.current.handlePageChange(2);
    });

    const nextParams = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(nextParams.get("page")).toBe("2");
    expect(setSearchParams.mock.calls[0][1]).toEqual({ replace: false });
    expect(requestMapBoundsUpdate).toHaveBeenCalledTimes(1);
    expect(setPreviousPage).not.toHaveBeenCalled();
  });

  it("ignores page changes while loading or at the current/max page", () => {
    const setSearchParams = jest.fn();
    const { result } = renderHook(() =>
      useSearchResultsNavigation({
        searchParams: new URLSearchParams("destination=Seoul&page=14"),
        searchParamsString: "destination=Seoul&page=14",
        currentPage: 14,
        isLoading: true,
        setSearchParams,
        requestMapBoundsUpdate: jest.fn(),
        setPreviousPage: jest.fn(),
      }),
    );

    act(() => {
      result.current.handlePageChange(14);
      result.current.handlePageChange(15);
    });

    expect(setSearchParams).not.toHaveBeenCalled();
  });
});
