import { act, renderHook } from "@testing-library/react";
import type { SearchActivePopover } from "../../model/searchInteractionReducer";
import { useSearchBarDestinationInteractions } from "./useSearchBarDestinationInteractions";

const createRef = <T>(element: T | null) => ({ current: element });

const createOptions = () => ({
  destinationInputRef: createRef<HTMLInputElement>(null),
  suggestionsRef: createRef<HTMLElement>(null),
  datePickerRef: createRef<HTMLElement>(null),
  guestPickerRef: createRef<HTMLElement>(null),
  datePickerElementRef: createRef<HTMLElement>(null),
  isExpanded: false,
  isMapDragMode: true,
  activePopover: "none" as const,
  exitMapDragMode: vi.fn(),
  changeDestination: vi.fn(),
  openDestination: vi.fn(),
  openDatePicker: vi.fn(),
  closeActivePopover: vi.fn(),
  collapseShell: vi.fn(),
  startDestinationSession: vi.fn(),
  completeCheckoutIfNeeded: vi.fn(),
});

describe("useSearchBarDestinationInteractions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it("opens the destination and focuses after compact expansion", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const options = {
      ...createOptions(),
      destinationInputRef: createRef(input),
    };
    const { result } = renderHook(() =>
      useSearchBarDestinationInteractions(options),
    );

    act(() => {
      result.current.handleDestinationClick({
        stopPropagation: vi.fn(),
      } as any);
      vi.runOnlyPendingTimers();
    });

    expect(options.openDestination).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();

    input.remove();
  });

  it("starts Places when destination receives focus after another panel expanded the shell", () => {
    const options = { ...createOptions(), isExpanded: true };
    const { result } = renderHook(() =>
      useSearchBarDestinationInteractions(options),
    );

    act(() => {
      result.current.handleDestinationFocus();
    });

    expect(options.startDestinationSession).toHaveBeenCalledTimes(1);
    expect(options.openDestination).toHaveBeenCalledTimes(1);
  });

  it("exits map mode for typing and clears the old map destination on focus", () => {
    const options = createOptions();
    const { result } = renderHook(() =>
      useSearchBarDestinationInteractions(options),
    );

    act(() => {
      result.current.handleDestinationChange("Busan");
      result.current.handleDestinationFocus();
    });

    expect(options.exitMapDragMode).toHaveBeenCalledTimes(2);
    expect(options.changeDestination).toHaveBeenNthCalledWith(1, "Busan");
    expect(options.changeDestination).toHaveBeenNthCalledWith(2, "");
    expect(options.openDestination).toHaveBeenCalledTimes(1);
  });

  it("moves Enter without a suggestion directly to the date popover", () => {
    const options = { ...createOptions(), isExpanded: true };
    const { result } = renderHook(() =>
      useSearchBarDestinationInteractions(options),
    );

    act(() => {
      result.current.handleDestinationEnterWithoutSuggestion();
    });

    expect(options.openDatePicker).toHaveBeenCalledTimes(1);
  });

  it("does not collapse when a blur is followed by another popover transition", () => {
    const options = {
      ...createOptions(),
      isExpanded: true,
      activePopover: "destination" as const,
    };
    const { result, rerender } = renderHook(
      ({ activePopover }: { activePopover: SearchActivePopover }) =>
        useSearchBarDestinationInteractions({
          ...options,
          activePopover,
        }),
      {
        initialProps: {
          activePopover: "destination" as SearchActivePopover,
        },
      },
    );

    act(() => {
      result.current.handleDestinationBlur();
    });
    rerender({ activePopover: "date" as const });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(options.closeActivePopover).not.toHaveBeenCalled();
    expect(options.collapseShell).not.toHaveBeenCalled();
  });

  it("closes and collapses a destination draft after an unclaimed blur", () => {
    const options = {
      ...createOptions(),
      isExpanded: true,
      activePopover: "destination" as const,
    };
    const { result } = renderHook(() =>
      useSearchBarDestinationInteractions(options),
    );

    act(() => {
      result.current.handleDestinationBlur();
      vi.advanceTimersByTime(100);
    });

    expect(options.closeActivePopover).toHaveBeenCalledTimes(1);
    expect(options.collapseShell).toHaveBeenCalledTimes(1);
  });
});
