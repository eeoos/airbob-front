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
  overrides: Partial<SearchBarState> = {}
): SearchBarState => ({
  checkIn: null,
  checkOut: null,
  adultOccupancy: 1,
  childOccupancy: 0,
  infantOccupancy: 0,
  petOccupancy: 0,
  isExpanded: false,
  showGuestPicker: false,
  showDatePicker: false,
  isComposing: false,
  isOpeningDatePicker: false,
  isOpeningGuestPicker: false,
  showSuggestions: false,
  inputText: "",
  suggestions: [],
  isPlacesLoading: false,
  selectedPlace: null,
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
  getTotalGuests: jest.fn(() => 1),
  ...overrides,
});

const seoulSuggestion = {
  placeId: "place-1",
  description: "서울, 대한민국",
  mainText: "서울",
  secondaryText: "대한민국",
};

const renderExpandedSearchBarWithSuggestions = (
  overrides: Partial<SearchBarState> = {}
) => {
  const handlePlaceSelect = jest.fn();

  mockUseSearchBarState.mockReturnValue(
    createSearchBarState({
      isExpanded: true,
      showSuggestions: true,
      inputText: "서",
      suggestions: [seoulSuggestion],
      handlePlaceSelect,
      ...overrides,
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
    const searchButtonStyles = getCssBlock(css, ".searchButton");
    const controlButtonStyles = getCssBlock(css, ".controlButton");
    const suggestionItemStyles = getCssBlock(css, ".suggestionItem");

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
