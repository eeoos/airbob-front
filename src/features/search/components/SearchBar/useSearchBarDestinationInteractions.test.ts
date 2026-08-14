import { act, renderHook } from "@testing-library/react";
import { useSearchBarDestinationInteractions } from "./useSearchBarDestinationInteractions";

const createRef = <T,>(element: T | null) => ({ current: element });

const createOptions = () => ({
  destinationInputRef: createRef<HTMLInputElement>(null),
  suggestionsRef: createRef<HTMLElement>(null),
  datePickerRef: createRef<HTMLElement>(null),
  guestPickerRef: createRef<HTMLElement>(null),
  datePickerElementRef: createRef<HTMLElement>(null),
  inputText: "Seoul",
  isExpanded: false,
  isMapDragMode: true,
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
});

describe("useSearchBarDestinationInteractions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("expands, starts a new destination session, and focuses the input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const options = {
      ...createOptions(),
      destinationInputRef: createRef(input),
      startNewSession: jest.fn(),
    };
    const { result } = renderHook(() =>
      useSearchBarDestinationInteractions(options),
    );

    act(() => {
      result.current.handleDestinationClick({
        stopPropagation: jest.fn(),
      } as any);
      jest.runOnlyPendingTimers();
    });

    expect(options.setExpanded).toHaveBeenCalledWith(true);
    expect(options.startNewSession).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();
    expect(options.setShowSuggestions).toHaveBeenCalledWith(true);

    input.remove();
  });

  it("clears map mode on input changes and focuses destination suggestions", () => {
    const options = createOptions();
    const { result } = renderHook(() =>
      useSearchBarDestinationInteractions(options),
    );

    act(() => {
      result.current.handleDestinationChange("Busan");
      result.current.handleDestinationFocus();
    });

    expect(options.exitMapDragMode).toHaveBeenCalledTimes(2);
    expect(options.handleInputChange).toHaveBeenNthCalledWith(1, "Busan");
    expect(options.handleInputChange).toHaveBeenNthCalledWith(2, "");
    expect(options.setShowDatePicker).toHaveBeenCalledWith(false);
    expect(options.setShowGuestPicker).toHaveBeenCalledWith(false);
    expect(options.setShowSuggestions).toHaveBeenCalledWith(true);
  });

  it("opens the date picker when Enter is pressed without a suggestion", () => {
    const options = {
      ...createOptions(),
      isExpanded: true,
    };
    const { result } = renderHook(() =>
      useSearchBarDestinationInteractions(options),
    );

    act(() => {
      result.current.handleDestinationEnterWithoutSuggestion();
    });

    expect(options.setIsOpeningDatePicker).toHaveBeenCalledWith(true);
    expect(options.setShowDatePicker).toHaveBeenCalledWith(true);
    expect(options.setShowGuestPicker).toHaveBeenCalledWith(false);
    expect(options.setShowSuggestions).toHaveBeenCalledWith(false);
  });

  it("cancels a delayed blur when focus returns to the destination input", () => {
    const options = createOptions();
    const { result } = renderHook(() =>
      useSearchBarDestinationInteractions(options),
    );

    act(() => {
      result.current.handleDestinationBlur();
      result.current.handleDestinationFocus();
      jest.advanceTimersByTime(100);
    });

    expect(options.setExpanded).not.toHaveBeenCalled();
    expect(options.setShowSuggestions).toHaveBeenCalledWith(true);
  });

  it("cancels the delayed input blur when focus moves into the next picker", () => {
    const options = {
      ...createOptions(),
      isExpanded: true,
    };
    const { result } = renderHook(() =>
      useSearchBarDestinationInteractions(options),
    );

    act(() => {
      result.current.handleDestinationEnterWithoutSuggestion();
      result.current.handleDestinationFocus();
      jest.advanceTimersByTime(100);
    });

    expect(options.setIsOpeningDatePicker).toHaveBeenCalledTimes(1);
    expect(options.setIsOpeningDatePicker).not.toHaveBeenCalledWith(false);
  });
});
