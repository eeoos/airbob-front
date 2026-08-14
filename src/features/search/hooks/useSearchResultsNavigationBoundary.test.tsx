import { renderHook, waitFor } from "@testing-library/react";
import * as navigationModule from "./useSearchResultsNavigation";

describe("useSearchResultsNavigation boundary", () => {
  it("exposes navigation actions separately from the query hook", async () => {
    const { result } = renderHook(() =>
      navigationModule.useSearchResultsNavigation({
        searchParams: new URLSearchParams(),
        searchParamsString: "",
        currentPage: 0,
        isLoading: false,
        setSearchParams: jest.fn(),
        requestMapBoundsUpdate: jest.fn(),
        setPreviousPage: jest.fn(),
      }),
    );

    await waitFor(() =>
      expect(result.current).toEqual(
        expect.objectContaining({
          handleMapBoundsChange: expect.any(Function),
          handlePageChange: expect.any(Function),
        }),
      ),
    );
  });
});
