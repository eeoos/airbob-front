import * as fs from "fs";
import * as path from "path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "./SearchBar";
import { useSearchBarState } from "../../hooks/useSearchBarState";

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
      getTotalGuests: jest.fn(() => 1),
      ...overrides.guests,
    },
    popover: {
      isExpanded: false,
      showGuestPicker: false,
      showDatePicker: false,
      isComposing: false,
      isOpeningDatePicker: false,
      isOpeningGuestPicker: false,
      showSuggestions: false,
      ...overrides.popover,
    },
    actions: {
      setAdultOccupancy: jest.fn(),
      setChildOccupancy: jest.fn(),
      setInfantOccupancy: jest.fn(),
      setPetOccupancy: jest.fn(),
      setExpanded: jest.fn(),
      setShowGuestPicker: jest.fn(),
      setShowDatePicker: jest.fn(),
      setIsComposing: jest.fn(),
      setIsOpeningDatePicker: jest.fn(),
      setIsOpeningGuestPicker: jest.fn(),
      setShowSuggestions: jest.fn(),
      handleInputChange: jest.fn(),
      handlePlaceSelect: jest.fn(),
      resetPlaces: jest.fn(),
      startNewSession: jest.fn(),
      handleSearch: jest.fn(),
      exitMapDragMode: jest.fn(),
      completeCheckoutIfNeeded: jest.fn(),
      closeTransientPanels: jest.fn(),
      openDatePicker: jest.fn(),
      toggleGuestPicker: jest.fn(),
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
  const handlePlaceSelect = jest.fn();

  mockUseSearchBarState.mockReturnValue(
    createSearchBarState({
      ...overrides,
      destination: {
        inputText: "서",
        suggestions: [seoulSuggestion],
        ...overrides.destination,
      },
      popover: {
        isExpanded: true,
        showSuggestions: true,
        ...overrides.popover,
      },
      actions: {
        handlePlaceSelect,
        ...overrides.actions,
      },
    })
  );

  render(<SearchBar />);

  return {
    handlePlaceSelect,
    suggestionButton: screen.getByRole("button", { name: /서울/ }),
  };
};

describe("SearchBar", () => {
  beforeEach(() => {
    mockUseSearchBarState.mockReturnValue(createSearchBarState());
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
    render(<SearchBar />);

    const searchButton = screen.getByRole("button", { name: "검색" });

    expect(searchButton).toHaveAttribute("type", "button");
  });

  it("renders date and guest segments as disclosure buttons", () => {
    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({ popover: { isExpanded: true } })
    );

    render(<SearchBar />);

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

  it("links expanded date and guest panels to their triggers", () => {
    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        popover: {
          isExpanded: true,
          showDatePicker: true,
          showGuestPicker: true,
        },
      })
    );

    render(<SearchBar />);

    const dateTrigger = screen.getByRole("button", {
      name: /체크인[\s\S]*체크아웃/,
    });
    const guestTrigger = screen.getByRole("button", { name: /여행자/ });

    expect(dateTrigger).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("search-date-picker")).toBeInTheDocument();
    expect(guestTrigger).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("search-guest-picker")).toBeInTheDocument();
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
          isExpanded: true,
          showGuestPicker: true,
        },
      })
    );

    render(<SearchBar />);

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
    const { handlePlaceSelect, suggestionButton } =
      renderExpandedSearchBarWithSuggestions();

    await userEvent.click(suggestionButton);

    expect(handlePlaceSelect).toHaveBeenCalledWith(seoulSuggestion);
  });

  it("updates destination input state, resets stale place selection, and opens suggestions while typing", async () => {
    const handleInputChange = jest.fn();
    const resetPlaces = jest.fn();
    const setShowSuggestions = jest.fn();

    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        destination: {
          inputText: "서",
          selectedPlace: {
            placeId: "stale-place",
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
          handleInputChange,
          resetPlaces,
          setShowSuggestions,
        },
      })
    );

    render(<SearchBar />);

    await userEvent.type(
      screen.getByPlaceholderText("어디로 여행가세요?"),
      "울"
    );

    expect(resetPlaces).toHaveBeenCalledTimes(1);
    expect(handleInputChange).toHaveBeenCalledWith("서울");
    expect(setShowSuggestions).toHaveBeenCalledWith(true);
  });

  it("clamps guest counter decrements at their minimum values", async () => {
    const setAdultOccupancy = jest.fn();
    const setChildOccupancy = jest.fn();
    const setInfantOccupancy = jest.fn();
    const setPetOccupancy = jest.fn();

    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        guests: {
          adultOccupancy: 1,
          childOccupancy: 0,
          infantOccupancy: 0,
          petOccupancy: 0,
        },
        popover: {
          isExpanded: true,
          showGuestPicker: true,
        },
        actions: {
          setAdultOccupancy,
          setChildOccupancy,
          setInfantOccupancy,
          setPetOccupancy,
        },
      })
    );

    render(<SearchBar />);

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

    expect(setAdultOccupancy).not.toHaveBeenCalled();
    expect(setChildOccupancy).not.toHaveBeenCalled();
    expect(setInfantOccupancy).not.toHaveBeenCalled();
    expect(setPetOccupancy).not.toHaveBeenCalled();
  });

  it("submits through the current search handler and closes open filters", async () => {
    const closeTransientPanels = jest.fn();
    const handleSearch = jest.fn();

    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        popover: {
          isExpanded: true,
          showDatePicker: true,
        },
        actions: {
          closeTransientPanels,
          handleSearch,
        },
      })
    );

    render(<SearchBar />);

    await userEvent.click(screen.getByRole("button", { name: "검색" }));

    expect(closeTransientPanels).toHaveBeenCalledWith({
      collapseWhenDateSelected: true,
    });
    expect(handleSearch).toHaveBeenCalledTimes(1);
  });

  it("closes the active guest popover on Escape", async () => {
    const setShowGuestPicker = jest.fn();

    mockUseSearchBarState.mockReturnValue(
      createSearchBarState({
        popover: {
          isExpanded: true,
          showGuestPicker: true,
        },
        actions: {
          setShowGuestPicker,
        },
      })
    );

    render(<SearchBar />);

    screen.getByRole("button", { name: "성인 인원 늘리기" }).focus();
    await userEvent.keyboard("{Escape}");

    expect(setShowGuestPicker).toHaveBeenCalledWith(false);
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("selects a place suggestion with %s", async (_keyName, key) => {
    const { handlePlaceSelect, suggestionButton } =
      renderExpandedSearchBarWithSuggestions();

    suggestionButton.focus();
    await userEvent.keyboard(key);

    expect(handlePlaceSelect).toHaveBeenCalledWith(seoulSuggestion);
  });
});
