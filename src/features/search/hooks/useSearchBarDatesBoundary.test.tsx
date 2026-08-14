import { renderHook, waitFor } from "@testing-library/react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePlacesAutocomplete } from "../../../hooks/usePlacesAutocomplete";
import { useSearchBarState } from "./useSearchBarState";
import * as searchBarDatesModule from "./useSearchBarDates";

jest.mock(
  "react-router-dom",
  () => ({
    useLocation: jest.fn(),
    useNavigate: jest.fn(),
    useSearchParams: jest.fn(),
  }),
  { virtual: true },
);

jest.mock("../../../hooks/usePlacesAutocomplete", () => ({
  usePlacesAutocomplete: jest.fn(),
}));

const mockNavigate = jest.fn();
const mockSetSearchParams = jest.fn();
const mockHandleInputChange = jest.fn();
const mockHandlePlaceSelect = jest.fn();
const mockResetPlaces = jest.fn();
const mockStartNewSession = jest.fn();

describe("useSearchBarState date boundary", () => {
  beforeEach(() => {
    jest.mocked(useNavigate).mockReturnValue(mockNavigate);
    jest.mocked(useLocation).mockReturnValue({ pathname: "/search" } as any);
    jest.mocked(useSearchParams).mockReturnValue([
      new URLSearchParams("destination=Seoul"),
      mockSetSearchParams,
    ] as any);
    jest.mocked(usePlacesAutocomplete).mockReturnValue({
      inputText: "Seoul",
      suggestions: [],
      isLoading: false,
      selectedPlace: null,
      handleInputChange: mockHandleInputChange,
      handlePlaceSelect: mockHandlePlaceSelect,
      reset: mockResetPlaces,
      startNewSession: mockStartNewSession,
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("delegates date state and date actions to a dedicated hook", async () => {
    const dateHook = jest.spyOn(searchBarDatesModule, "useSearchBarDates");

    renderHook(() => useSearchBarState());

    await waitFor(() => expect(dateHook).toHaveBeenCalled());
  });
});
