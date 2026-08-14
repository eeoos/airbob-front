import { act, renderHook } from "@testing-library/react";
import { useSearchBarShellInteractions } from "./useSearchBarShellInteractions";

const createRef = <T extends HTMLElement>(element: T | null) => ({
  current: element,
});

const createOptions = () => ({
  searchBarRef: createRef<HTMLDivElement>(null),
  datePickerRef: createRef<HTMLDivElement>(null),
  guestPickerRef: createRef<HTMLDivElement>(null),
  datePickerElementRef: createRef<HTMLDivElement>(null),
  destinationAreaRef: createRef<HTMLDivElement>(null),
  suggestionsRef: createRef<HTMLDivElement>(null),
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
});

describe("useSearchBarShellInteractions", () => {
  it("expands without closing when an internal search region is clicked", () => {
    const destinationArea = document.createElement("div");
    const options = {
      ...createOptions(),
      destinationAreaRef: createRef(destinationArea),
    };
    const { result } = renderHook(() =>
      useSearchBarShellInteractions(options),
    );

    act(() => {
      result.current.handleSearchBarClick({
        target: destinationArea,
        stopPropagation: jest.fn(),
      } as any);
    });

    expect(options.setExpanded).toHaveBeenCalledWith(true);
    expect(options.closeTransientPanels).not.toHaveBeenCalled();
  });

  it("closes transient panels instead of collapsing an active shell", () => {
    const outside = document.createElement("button");
    const stopPropagation = jest.fn();
    const options = {
      ...createOptions(),
      showDatePicker: true,
      isExpanded: true,
    };
    const { result } = renderHook(() =>
      useSearchBarShellInteractions(options),
    );

    act(() => {
      result.current.handleSearchBarClick({
        target: outside,
        stopPropagation,
      } as any);
    });

    expect(options.closeTransientPanels).toHaveBeenCalledWith({
      collapseWhenDateSelected: true,
    });
    expect(options.setExpanded).not.toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("collapses the shell when no transient panel is open", () => {
    const outside = document.createElement("button");
    const stopPropagation = jest.fn();
    const options = {
      ...createOptions(),
      isExpanded: true,
    };
    const { result } = renderHook(() =>
      useSearchBarShellInteractions(options),
    );

    act(() => {
      result.current.handleSearchBarClick({
        target: outside,
        stopPropagation,
      } as any);
    });

    expect(options.setExpanded).toHaveBeenCalledWith(false);
    expect(options.closeTransientPanels).not.toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("keeps date and guest trigger side effects at the interaction boundary", () => {
    const options = createOptions();
    const dateStopPropagation = jest.fn();
    const datePreventDefault = jest.fn();
    const guestStopPropagation = jest.fn();
    const guestPreventDefault = jest.fn();
    const { result } = renderHook(() =>
      useSearchBarShellInteractions(options),
    );

    act(() => {
      result.current.handleDateClick({
        stopPropagation: dateStopPropagation,
        preventDefault: datePreventDefault,
      } as any);
      result.current.handleGuestClick({
        stopPropagation: guestStopPropagation,
        preventDefault: guestPreventDefault,
      } as any);
      result.current.closeDatePopover();
    });

    expect(dateStopPropagation).toHaveBeenCalledTimes(1);
    expect(datePreventDefault).toHaveBeenCalledTimes(1);
    expect(options.openDatePicker).toHaveBeenCalledTimes(1);
    expect(guestStopPropagation).toHaveBeenCalledTimes(1);
    expect(guestPreventDefault).toHaveBeenCalledTimes(1);
    expect(options.toggleGuestPicker).toHaveBeenCalledTimes(1);
    expect(options.completeCheckoutIfNeeded).toHaveBeenCalledTimes(1);
    expect(options.setShowDatePicker).toHaveBeenCalledWith(false);
  });

  it("recognizes the search button as an internal region", () => {
    const searchButton = document.createElement("button");
    searchButton.className = "search-button";
    const options = {
      ...createOptions(),
      searchButtonClassName: "search-button",
      isExpanded: false,
    };
    const { result } = renderHook(() =>
      useSearchBarShellInteractions(options),
    );

    act(() => {
      result.current.handleSearchBarClick({
        target: searchButton,
        stopPropagation: jest.fn(),
      } as any);
    });

    expect(options.setExpanded).toHaveBeenCalledWith(true);
    expect(options.closeTransientPanels).not.toHaveBeenCalled();
  });
});
