import * as fs from "fs";
import * as path from "path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "./SearchBar";
import {
  type SearchBarRoutePort,
  useSearchBarState,
} from "../../hooks/useSearchBarState";

jest.mock("../../hooks/useSearchBarState", () => ({
  useSearchBarState: jest.fn(),
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

const mockUseSearchBarState = useSearchBarState as jest.MockedFunction<
  typeof useSearchBarState
>;

const routePort: SearchBarRoutePort = {
  currentSearchParams: new URLSearchParams(),
  isSearchRoute: false,
  pushSearch: jest.fn(),
  replaceSearch: jest.fn(),
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
  overrides: SearchBarStateOverrides = {}
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
      changeAdultOccupancy: jest.fn(),
      changeChildOccupancy: jest.fn(),
      changeInfantOccupancy: jest.fn(),
      changePetOccupancy: jest.fn(),
      expandShell: jest.fn(),
      collapseShell: jest.fn(),
      openDestination: jest.fn(),
      openDatePicker: jest.fn(),
      toggleGuestPicker: jest.fn(),
      closeActivePopover: jest.fn(),
      startComposition: jest.fn(),
      endComposition: jest.fn(),
      changeDestination: jest.fn(),
      selectDestination: jest.fn(),
      clearDestinationSelection: jest.fn(),
      startDestinationSession: jest.fn(),
      handleSearch: jest.fn(),
      exitMapDragMode: jest.fn(),
      completeCheckoutIfNeeded: jest.fn(),
      closeTransientPanels: jest.fn(),
      handleDateSelect: jest.fn(),
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
  overrides: SearchBarStateOverrides = {}
) => {
  const selectDestination = jest.fn();

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
    })
  );

  render(<SearchBar routePort={routePort} />);

  return {
    selectDestination,
    suggestionButton: screen.getByRole("button", { name: /서울/ }),
  };
};

describe("SearchBar", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-10T12:00:00"));
    mockUseSearchBarState.mockReturnValue(createSearchBarState());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps icon controls at the shared touch target and resets suggestion buttons", () => {
    const css = readProjectFile(
      "src/features/search/components/SearchBar/SearchBar.module.css"
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
      "min-width: var(--control-touch-target);"
    );
    expect(searchButtonStyles).toContain(
      "min-height: var(--control-touch-target);"
    );
    expect(controlButtonStyles).toContain(
      "min-width: var(--control-touch-target);"
    );
    expect(controlButtonStyles).toContain(
      "min-height: var(--control-touch-target);"
    );
    expect(suggestionItemStyles).toContain("appearance: none;");
    expect(suggestionItemStyles).toContain("border: 0;");
    expect(suggestionItemStyles).toContain("width: 100%;");
    expect(suggestionItemStyles).toContain("text-align: left;");
  });

  it("names the search icon button and keeps it out of form submission", () => {
    render(<SearchBar routePort={routePort} />);

    const searchButton = screen.getByRole("button", { name: "검색" });

    expect(searchButton).toHaveAttribute("type", "button");
    expect(screen.getByRole("search", { name: "숙소 검색" })).toHaveAttribute(
      "data-search-shell",
      "compact",
    );
  });

  it("renders date and guest segments as disclosure buttons", () => {
    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({ popover: { isExpanded: true } })
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
    expect(guestTrigger).toHaveAttribute("aria-controls", "search-guest-picker");
  });

  it("links the active date panel to its trigger", () => {
    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        popover: {
          activePopover: "date",
          isExpanded: true,
          showDatePicker: true,
        },
      })
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
      })
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
      })
    );

    render(<SearchBar routePort={routePort} />);

    expect(screen.getByRole("button", { name: label })).toHaveAttribute(
      "type",
      "button"
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
    const changeDestination = jest.fn();
    const clearDestinationSelection = jest.fn();
    const openDestination = jest.fn();

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
      })
    );

    render(<SearchBar routePort={routePort} />);

    await userEvent.type(
      screen.getByPlaceholderText("어디로 여행가세요?"),
      "울"
    );

    expect(clearDestinationSelection).toHaveBeenCalledTimes(1);
    expect(changeDestination).toHaveBeenCalledWith("서울");
    expect(openDestination).toHaveBeenCalled();
  });

  it("clamps guest counter decrements at their minimum values", async () => {
    const changeAdultOccupancy = jest.fn();
    const changeChildOccupancy = jest.fn();
    const changeInfantOccupancy = jest.fn();
    const changePetOccupancy = jest.fn();

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
      })
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
    const closeTransientPanels = jest.fn();
    const handleSearch = jest.fn();

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
      })
    );

    render(<SearchBar routePort={routePort} />);

    await userEvent.click(screen.getByRole("button", { name: "검색" }));

    expect(closeTransientPanels).toHaveBeenCalledWith({
      collapseWhenDateSelected: true,
    });
    expect(handleSearch).toHaveBeenCalledTimes(1);
  });

  it("closes the active guest popover on Escape", async () => {
    const closeActivePopover = jest.fn();

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
      })
    );

    render(<SearchBar routePort={routePort} />);

    screen.getByRole("button", { name: "성인 인원 늘리기" }).focus();
    await userEvent.keyboard("{Escape}");

    expect(closeActivePopover).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /여행자/ })).toHaveFocus();
  });

  it("closes the active date popover from its trigger and restores focus", async () => {
    const closeActivePopover = jest.fn();
    const completeCheckoutIfNeeded = jest.fn();

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

    render(<SearchBar routePort={routePort} />);
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
