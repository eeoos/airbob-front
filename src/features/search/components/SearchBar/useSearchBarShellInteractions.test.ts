import { act, renderHook } from "@testing-library/react";
import { useSearchBarShellInteractions } from "./useSearchBarShellInteractions";

const createRef = <T extends HTMLElement>(element: T | null) => ({
  current: element,
});

const createOptions = () => ({
  datePickerRef: createRef<HTMLDivElement>(null),
  guestPickerRef: createRef<HTMLDivElement>(null),
  datePickerElementRef: createRef<HTMLDivElement>(null),
  destinationAreaRef: createRef<HTMLDivElement>(null),
  suggestionsRef: createRef<HTMLDivElement>(null),
  searchButtonClassName: "search-button",
  isExpanded: false,
  activePopover: "none" as const,
  completeCheckoutIfNeeded: vi.fn(),
  closeTransientPanels: vi.fn(),
  expandShell: vi.fn(),
  collapseShell: vi.fn(),
  closeActivePopover: vi.fn(),
  openDatePicker: vi.fn(),
  toggleGuestPicker: vi.fn(),
});

describe("useSearchBarShellInteractions", () => {
  it("expands without closing when an internal search region is clicked", () => {
    const destinationArea = document.createElement("div");
    const options = {
      ...createOptions(),
      destinationAreaRef: createRef(destinationArea),
    };
    const { result } = renderHook(() => useSearchBarShellInteractions(options));

    act(() => {
      result.current.handleSearchBarClick({
        target: destinationArea,
        stopPropagation: vi.fn(),
      } as any);
    });

    expect(options.expandShell).toHaveBeenCalledTimes(1);
    expect(options.closeTransientPanels).not.toHaveBeenCalled();
  });

  it("closes an active popover instead of collapsing through a second path", () => {
    const outside = document.createElement("button");
    const stopPropagation = vi.fn();
    const options = {
      ...createOptions(),
      activePopover: "date" as const,
      isExpanded: true,
    };
    const { result } = renderHook(() => useSearchBarShellInteractions(options));

    act(() => {
      result.current.handleSearchBarClick({
        target: outside,
        stopPropagation,
      } as any);
    });

    expect(options.closeTransientPanels).toHaveBeenCalledWith({
      collapseWhenDateSelected: true,
    });
    expect(options.collapseShell).not.toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("collapses the shell when no popover is active", () => {
    const outside = document.createElement("button");
    const options = { ...createOptions(), isExpanded: true };
    const { result } = renderHook(() => useSearchBarShellInteractions(options));

    act(() => {
      result.current.handleSearchBarClick({
        target: outside,
        stopPropagation: vi.fn(),
      } as any);
    });

    expect(options.collapseShell).toHaveBeenCalledTimes(1);
  });

  it("maps date and guest triggers to mutually-exclusive reducer events", () => {
    const options = createOptions();
    const { result } = renderHook(() => useSearchBarShellInteractions(options));

    act(() => {
      result.current.handleDateClick({
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      } as any);
      result.current.handleGuestClick({
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      } as any);
      result.current.closeDatePopover();
    });

    expect(options.openDatePicker).toHaveBeenCalledTimes(1);
    expect(options.toggleGuestPicker).toHaveBeenCalledTimes(1);
    expect(options.completeCheckoutIfNeeded).toHaveBeenCalledTimes(1);
    expect(options.closeActivePopover).toHaveBeenCalledTimes(1);
  });
});
