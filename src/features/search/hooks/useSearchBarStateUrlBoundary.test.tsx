import { renderHook, waitFor } from "@testing-library/react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePlacesAutocomplete } from "../../../hooks/usePlacesAutocomplete";
import { useSearchBarState } from "./useSearchBarState";
import * as searchBarUrlStateModule from "../lib/searchBarUrlState";

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

describe("useSearchBarState URL boundary", () => {
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

  it("delegates URL signature and parsing to the pure URL state boundary", async () => {
    const getSearchBarUrlStateSignature = jest.spyOn(
      searchBarUrlStateModule,
      "getSearchBarUrlStateSignature",
    );
    const parseSearchBarUrlState = jest.spyOn(
      searchBarUrlStateModule,
      "parseSearchBarUrlState",
    );

    renderHook(() => useSearchBarState());

    await waitFor(() =>
      expect(getSearchBarUrlStateSignature).toHaveBeenCalledWith(
        expect.any(URLSearchParams),
      ),
    );
    await waitFor(() =>
      expect(parseSearchBarUrlState).toHaveBeenCalledWith(
        expect.any(URLSearchParams),
      ),
    );
  });
});
