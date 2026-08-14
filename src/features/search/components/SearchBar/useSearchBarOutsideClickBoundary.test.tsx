import { renderHook, waitFor } from "@testing-library/react";
import { useSearchBarOutsideClick } from "./useSearchBarOutsideClick";

describe("useSearchBarOutsideClick boundary", () => {
  it("is exposed as a dedicated SearchBar interaction hook", async () => {
    const { result } = renderHook(() =>
      useSearchBarOutsideClick({
        searchBarRef: { current: null },
        datePickerRef: { current: null },
        guestPickerRef: { current: null },
        datePickerElementRef: { current: null },
        destinationAreaRef: { current: null },
        suggestionsRef: { current: null },
        showDatePicker: false,
        showGuestPicker: false,
        showSuggestions: false,
        closeTransientPanels: jest.fn(),
        setExpanded: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current).toBeUndefined());
  });
});
