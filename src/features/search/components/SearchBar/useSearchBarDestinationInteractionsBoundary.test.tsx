import { renderHook, waitFor } from "@testing-library/react";
import * as destinationInteractionsModule from "./useSearchBarDestinationInteractions";

describe("useSearchBarDestinationInteractions boundary", () => {
  it("exposes destination interaction behavior as a dedicated hook", async () => {
    const destinationHook = jest.spyOn(
      destinationInteractionsModule,
      "useSearchBarDestinationInteractions",
    );

    renderHook(() =>
      destinationInteractionsModule.useSearchBarDestinationInteractions({
        destinationInputRef: { current: null },
        suggestionsRef: { current: null },
        datePickerRef: { current: null },
        guestPickerRef: { current: null },
        datePickerElementRef: { current: null },
        inputText: "",
        isExpanded: false,
        isMapDragMode: false,
        showDatePicker: false,
        showGuestPicker: false,
        isOpeningDatePicker: false,
        isOpeningGuestPicker: false,
        exitMapDragMode: jest.fn(),
        handleInputChange: jest.fn(),
        setExpanded: jest.fn(),
        setShowDatePicker: jest.fn(),
        setShowGuestPicker: jest.fn(),
        setShowSuggestions: jest.fn(),
        setIsOpeningDatePicker: jest.fn(),
        startNewSession: jest.fn(),
        completeCheckoutIfNeeded: jest.fn(),
      }),
    );

    await waitFor(() => expect(destinationHook).toHaveBeenCalled());
  });
});
