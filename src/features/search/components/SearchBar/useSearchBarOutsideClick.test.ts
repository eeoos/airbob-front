import { act, renderHook } from "@testing-library/react";
import { useSearchBarOutsideClick } from "./useSearchBarOutsideClick";

const createRef = (element: HTMLElement | null) => ({ current: element });

describe("useSearchBarOutsideClick", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("closes transient panels and collapses the search bar for an outside click", () => {
    const searchBar = document.createElement("div");
    document.body.appendChild(searchBar);
    const closeTransientPanels = jest.fn();
    const collapseShell = jest.fn();

    renderHook(() =>
      useSearchBarOutsideClick({
        searchBarRef: createRef(searchBar),
        datePickerRef: createRef(null),
        guestPickerRef: createRef(null),
        datePickerElementRef: createRef(null),
        destinationAreaRef: createRef(null),
        suggestionsRef: createRef(null),
        activePopover: "date",
        closeTransientPanels,
        collapseShell,
      }),
    );

    act(() => {
      jest.advanceTimersByTime(100);
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(closeTransientPanels).toHaveBeenCalledWith({
      collapseWhenDateSelected: true,
    });
    expect(collapseShell).toHaveBeenCalledTimes(1);

    searchBar.remove();
  });

  it("ignores clicks inside the search bar and its registered panel areas", () => {
    const searchBar = document.createElement("div");
    const dateArea = document.createElement("div");
    searchBar.appendChild(dateArea);
    document.body.append(searchBar);

    const closeTransientPanels = jest.fn();
    const collapseShell = jest.fn();
    renderHook(() =>
      useSearchBarOutsideClick({
        searchBarRef: createRef(searchBar),
        datePickerRef: createRef(dateArea),
        guestPickerRef: createRef(null),
        datePickerElementRef: createRef(null),
        destinationAreaRef: createRef(null),
        suggestionsRef: createRef(null),
        activePopover: "date",
        closeTransientPanels,
        collapseShell,
      }),
    );

    act(() => {
      jest.advanceTimersByTime(100);
      dateArea.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(closeTransientPanels).not.toHaveBeenCalled();
    expect(collapseShell).not.toHaveBeenCalled();

    searchBar.remove();
  });
});
