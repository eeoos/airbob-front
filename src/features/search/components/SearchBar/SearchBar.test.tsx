import * as fs from "fs";
import * as path from "path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MockedFunction } from "vitest";
import { OverlayProvider } from "../../../../app/overlays/OverlayProvider";
import { SearchBar } from "./SearchBar";
import {
  type SearchBarRoutePort,
  useSearchBarState,
} from "../../hooks/useSearchBarState";

vi.mock("../../hooks/useSearchBarState", () => ({
  useSearchBarState: vi.fn(),
}));

type SearchBarState = ReturnType<typeof useSearchBarState>;
type SearchBarStateOverrides = {
  destination?: Partial<SearchBarState["destination"]>;
  dates?: Partial<SearchBarState["dates"]>;
  guests?: Partial<SearchBarState["guests"]>;
  popover?: Partial<SearchBarState["popover"]>;
  actions?: Partial<SearchBarState["actions"]>;
  status?: Partial<SearchBarState["status"]>;
};

const mockUseSearchBarState = useSearchBarState as MockedFunction<
  typeof useSearchBarState
>;

const routePort: SearchBarRoutePort = {
  currentSearchParams: new URLSearchParams(),
  isSearchRoute: false,
  pushSearch: vi.fn(),
  replaceSearch: vi.fn(),
};

const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const getCssBlock = (source: string, selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  if (!match) {
    throw new Error(`Missing CSS block for ${selector}`);
  }

  return match[1];
};

const createSearchBarState = (
  overrides: SearchBarStateOverrides = {},
): SearchBarState => {
  const state = {
    destination: {
      inputText: "",
      suggestions: [],
      selectedPlace: null,
      ...overrides.destination,
    },
    dates: {
      checkIn: null,
      checkOut: null,
      ...overrides.dates,
    },
    guests: {
      adultOccupancy: 1,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
      totalGuests: 1,
      ...overrides.guests,
    },
    popover: {
      activePopover: "none",
      isExpanded: false,
      showGuestPicker: false,
      showDatePicker: false,
      isComposing: false,
      showSuggestions: false,
      ...overrides.popover,
    },
    actions: {
      changeAdultOccupancy: vi.fn(),
      changeChildOccupancy: vi.fn(),
      changeInfantOccupancy: vi.fn(),
      changePetOccupancy: vi.fn(),
      expandShell: vi.fn(),
      collapseShell: vi.fn(),
      openDestination: vi.fn(),
      openDatePicker: vi.fn(),
      toggleGuestPicker: vi.fn(),
      closeActivePopover: vi.fn(),
      startComposition: vi.fn(),
      endComposition: vi.fn(),
      changeDestination: vi.fn(),
      selectDestination: vi.fn(),
      clearDestinationSelection: vi.fn(),
      startDestinationSession: vi.fn(),
      handleSearch: vi.fn(),
      exitMapDragMode: vi.fn(),
      completeCheckoutIfNeeded: vi.fn(),
      closeTransientPanels: vi.fn(),
      handleDateSelect: vi.fn(),
      ...overrides.actions,
    },
    status: {
      isPlacesLoading: false,
      ...overrides.status,
    },
  } satisfies SearchBarState;

  return state;
};

const seoulSuggestion = {
  placeId: "place-1",
  description: "서울, 대한민국",
  mainText: "서울",
  secondaryText: "대한민국",
};

const renderExpandedSearchBarWithSuggestions = (
  overrides: SearchBarStateOverrides = {},
) => {
  const selectDestination = vi.fn();

  mockUseSearchBarState.mockReturnValue(
    createSearchBarState({
      ...overrides,
      destination: {
        inputText: "서",
        suggestions: [seoulSuggestion],
        ...overrides.destination,
      },
      popover: {
        activePopover: "destination",
        isExpanded: true,
        showSuggestions: true,
        ...overrides.popover,
      },
      actions: {
        selectDestination,
        ...overrides.actions,
      },
    }),
  );

  render(<SearchBar routePort={routePort} />);

  return {
    selectDestination,
    suggestionButton: screen.getByRole("button", { name: /서울/ }),
  };
};

describe("SearchBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00"));
    mockUseSearchBarState.mockReturnValue(createSearchBarState());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps icon controls at the shared touch target and resets suggestion buttons", () => {
    const css = readProjectFile(
      "src/features/search/components/SearchBar/SearchBar.module.css",
    );
    const searchItemStyles = getCssBlock(css, ".searchItem");
    const searchButtonStyles = getCssBlock(css, ".searchButton");
    const controlButtonStyles = getCssBlock(css, ".controlButton");
    const suggestionItemStyles = getCssBlock(css, ".suggestionItem");

    expect(searchItemStyles).toContain("appearance: none;");
    expect(searchItemStyles).toContain("border: 0;");
    expect(searchItemStyles).toContain("background: transparent;");
    expect(searchItemStyles).toContain("font: inherit;");
    expect(searchButtonStyles).toContain(
      "min-width: var(--control-touch-target);",
    );
    expect(searchButtonStyles).toContain(
      "min-height: var(--control-touch-target);",
    );
    expect(controlButtonStyles).toContain(
      "min-width: var(--control-touch-target);",
    );
    expect(controlButtonStyles).toContain(
      "min-height: var(--control-touch-target);",
    );
    expect(suggestionItemStyles).toContain("appearance: none;");
    expect(suggestionItemStyles).toContain("border: 0;");
    expect(suggestionItemStyles).toContain("width: 100%;");
    expect(suggestionItemStyles).toContain("text-align: left;");
  });

  it("names the search icon button and keeps it out of form submission", async () => {
    const state = createSearchBarState();
    mockUseSearchBarState.mockReturnValue(state);

    render(<SearchBar routePort={routePort} />);

    const searchButton = screen.getByRole("button", { name: "검색" });
    const destinationButton = screen.getByRole("button", { name: "어디든지" });

    expect(searchButton).toHaveAttribute("type", "button");
    expect(destinationButton).toHaveAttribute("type", "button");
    expect(screen.getByRole("search", { name: "숙소 검색" })).toHaveAttribute(
      "data-search-shell",
      "compact",
    );

    await userEvent.click(destinationButton);

    expect(state.actions.expandShell).toHaveBeenCalledTimes(1);
    expect(state.actions.openDestination).toHaveBeenCalledTimes(1);
  });

  it("renders date and guest segments as disclosure buttons", () => {
    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({ popover: { isExpanded: true } }),
    );

    render(<SearchBar routePort={routePort} />);

    const dateTrigger = screen.getByRole("button", {
      name: /체크인[\s\S]*체크아웃/,
    });
    const guestTrigger = screen.getByRole("button", { name: /여행자/ });

    expect(dateTrigger).toHaveAttribute("type", "button");
    expect(dateTrigger).toHaveAttribute("aria-expanded", "false");
    expect(dateTrigger).toHaveAttribute("aria-controls", "search-date-picker");
    expect(guestTrigger).toHaveAttribute("type", "button");
    expect(guestTrigger).toHaveAttribute("aria-expanded", "false");
    expect(guestTrigger).toHaveAttribute(
      "aria-controls",
      "search-guest-picker",
    );
  });

  it("links the active date panel to its trigger", () => {
    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        popover: {
          activePopover: "date",
          isExpanded: true,
          showDatePicker: true,
        },
      }),
    );

    render(<SearchBar routePort={routePort} />);

    const dateTrigger = screen.getByRole("button", {
      name: /체크인[\s\S]*체크아웃/,
    });
    expect(dateTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("2026년 7월").length).toBeGreaterThan(0);
  });

  it("links the active guest panel to its trigger", () => {
    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        popover: {
          activePopover: "guests",
          isExpanded: true,
          showGuestPicker: true,
        },
      }),
    );

    render(<SearchBar routePort={routePort} />);

    const guestTrigger = screen.getByRole("button", { name: /여행자/ });

    expect(guestTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("성인")).toBeInTheDocument();
  });

  it.each([
    "성인 인원 줄이기",
    "성인 인원 늘리기",
    "어린이 인원 줄이기",
    "어린이 인원 늘리기",
    "유아 인원 줄이기",
    "유아 인원 늘리기",
    "반려동물 수 줄이기",
    "반려동물 수 늘리기",
  ])("labels the %s counter button", (label) => {
    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        popover: {
          activePopover: "guests",
          isExpanded: true,
          showGuestPicker: true,
        },
      }),
    );

    render(<SearchBar routePort={routePort} />);

    expect(screen.getByRole("button", { name: label })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("renders place suggestions as semantic buttons", () => {
    const { suggestionButton } = renderExpandedSearchBarWithSuggestions();

    expect(suggestionButton).toHaveAttribute("type", "button");
  });

  it("selects a place suggestion with pointer activation", async () => {
    const { selectDestination, suggestionButton } =
      renderExpandedSearchBarWithSuggestions();

    await userEvent.click(suggestionButton);

    expect(selectDestination).toHaveBeenCalledWith(seoulSuggestion);
  });

  it("updates destination input state, resets stale place selection, and opens suggestions while typing", async () => {
    const changeDestination = vi.fn();
    const clearDestinationSelection = vi.fn();
    const openDestination = vi.fn();

    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        destination: {
          inputText: "서",
          selectedPlace: {
            lat: 37.5665,
            lng: 126.978,
            viewport: {
              north: 37.7,
              south: 37.4,
              east: 127.1,
              west: 126.8,
            },
          },
        },
        popover: {
          isExpanded: true,
        },
        actions: {
          changeDestination,
          clearDestinationSelection,
          openDestination,
        },
      }),
    );

    render(<SearchBar routePort={routePort} />);

    await userEvent.type(
      screen.getByPlaceholderText("어디로 여행가세요?"),
      "울",
    );

    expect(clearDestinationSelection).toHaveBeenCalledTimes(1);
    expect(changeDestination).toHaveBeenCalledWith("서울");
    expect(openDestination).toHaveBeenCalled();
  });

  it("clamps guest counter decrements at their minimum values", async () => {
    const changeAdultOccupancy = vi.fn();
    const changeChildOccupancy = vi.fn();
    const changeInfantOccupancy = vi.fn();
    const changePetOccupancy = vi.fn();

    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        guests: {
          adultOccupancy: 1,
          childOccupancy: 0,
          infantOccupancy: 0,
          petOccupancy: 0,
        },
        popover: {
          activePopover: "guests",
          isExpanded: true,
          showGuestPicker: true,
        },
        actions: {
          changeAdultOccupancy,
          changeChildOccupancy,
          changeInfantOccupancy,
          changePetOccupancy,
        },
      }),
    );

    render(<SearchBar routePort={routePort} />);

    const decrementLabels = [
      "성인 인원 줄이기",
      "어린이 인원 줄이기",
      "유아 인원 줄이기",
      "반려동물 수 줄이기",
    ];

    decrementLabels.forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    });

    for (const label of decrementLabels) {
      await userEvent.click(screen.getByRole("button", { name: label }));
    }

    expect(changeAdultOccupancy).not.toHaveBeenCalled();
    expect(changeChildOccupancy).not.toHaveBeenCalled();
    expect(changeInfantOccupancy).not.toHaveBeenCalled();
    expect(changePetOccupancy).not.toHaveBeenCalled();
  });

  it("submits through the current search handler and closes open filters", async () => {
    const closeTransientPanels = vi.fn();
    const handleSearch = vi.fn();

    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        popover: {
          activePopover: "date",
          isExpanded: true,
          showDatePicker: true,
        },
        actions: {
          closeTransientPanels,
          handleSearch,
        },
      }),
    );

    render(<SearchBar routePort={routePort} />);

    await userEvent.click(screen.getByRole("button", { name: "검색" }));

    expect(closeTransientPanels).toHaveBeenCalledWith({
      collapseWhenDateSelected: true,
    });
    expect(handleSearch).toHaveBeenCalledTimes(1);
  });

  it("closes the active guest popover on Escape", async () => {
    const closeActivePopover = vi.fn();

    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        popover: {
          activePopover: "guests",
          isExpanded: true,
          showGuestPicker: true,
        },
        actions: {
          closeActivePopover,
        },
      }),
    );

    render(
      <OverlayProvider>
        <SearchBar routePort={routePort} />
      </OverlayProvider>,
    );

    screen.getByRole("button", { name: "성인 인원 늘리기" }).focus();
    expect(screen.getByRole("search", { name: "숙소 검색" })).toContainElement(
      screen.getByText("성인"),
    );
    expect(document.body).toHaveStyle({ overflow: "" });
    await userEvent.keyboard("{Escape}");

    expect(closeActivePopover).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /여행자/ })).toHaveFocus();
  });

  it("closes the active date popover from its trigger and restores focus", async () => {
    const closeActivePopover = vi.fn();
    const completeCheckoutIfNeeded = vi.fn();

    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        popover: {
          activePopover: "date",
          isExpanded: true,
          showDatePicker: true,
        },
        actions: {
          closeActivePopover,
          completeCheckoutIfNeeded,
        },
      }),
    );

    render(
      <OverlayProvider>
        <SearchBar routePort={routePort} />
      </OverlayProvider>,
    );
    const dateTrigger = screen.getByRole("button", {
      name: /체크인[\s\S]*체크아웃/,
    });

    expect(screen.getByRole("search", { name: "숙소 검색" })).toHaveAttribute(
      "data-search-shell",
      "expanded",
    );
    dateTrigger.focus();
    await userEvent.keyboard("{Escape}");

    expect(completeCheckoutIfNeeded).toHaveBeenCalledTimes(1);
    expect(closeActivePopover).toHaveBeenCalledTimes(1);
    expect(dateTrigger).toHaveFocus();
  });

  it("closes the date picker from an active date cell and restores trigger focus", async () => {
    const closeActivePopover = vi.fn();
    const completeCheckoutIfNeeded = vi.fn();
    const collapseShell = vi.fn();

    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        popover: {
          activePopover: "date",
          isExpanded: true,
          showDatePicker: true,
        },
        actions: {
          closeActivePopover,
          completeCheckoutIfNeeded,
          collapseShell,
        },
      }),
    );

    render(<SearchBar routePort={routePort} />);
    const dateTrigger = screen.getByRole("button", {
      name: /체크인[\s\S]*체크아웃/,
    });
    const activeDate = screen.getByRole("gridcell", {
      name: "2026년 7월 10일 금요일",
    });

    activeDate.focus();
    await userEvent.keyboard("{Escape}");

    expect(completeCheckoutIfNeeded).toHaveBeenCalledTimes(1);
    expect(closeActivePopover).toHaveBeenCalledTimes(1);
    expect(collapseShell).not.toHaveBeenCalled();
    expect(dateTrigger).toHaveFocus();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("selects a place suggestion with %s", async (_keyName, key) => {
    const { selectDestination, suggestionButton } =
      renderExpandedSearchBarWithSuggestions();

    suggestionButton.focus();
    await userEvent.keyboard(key);

    expect(selectDestination).toHaveBeenCalledWith(seoulSuggestion);
  });
});
