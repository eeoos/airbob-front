import { renderHook } from "@testing-library/react";
import { useSearchBarShellInteractions } from "./useSearchBarShellInteractions";

describe("useSearchBarShellInteractions boundary", () => {
  it("exposes the SearchBar shell interaction contract", () => {
    const { result } = renderHook(() =>
      useSearchBarShellInteractions({
        searchBarRef: { current: null },
        datePickerRef: { current: null },
        guestPickerRef: { current: null },
        datePickerElementRef: { current: null },
        destinationAreaRef: { current: null },
        suggestionsRef: { current: null },
        searchButtonClassName: "search-button",
        isExpanded: false,
        showDatePicker: false,
        showGuestPicker: false,
        showSuggestions: false,
        completeCheckoutIfNeeded: jest.fn(),
        closeTransientPanels: jest.fn(),
        setExpanded: jest.fn(),
        setShowDatePicker: jest.fn(),
        openDatePicker: jest.fn(),
        toggleGuestPicker: jest.fn(),
      }),
    );

    expect(result.current).toEqual(
      expect.objectContaining({
        closeDatePopover: expect.any(Function),
        handleDateClick: expect.any(Function),
        handleGuestClick: expect.any(Function),
        handleSearchBarClick: expect.any(Function),
      }),
    );
  });
});
