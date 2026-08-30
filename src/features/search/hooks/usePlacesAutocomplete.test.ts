import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, StrictMode, type ReactNode } from "react";
import {
  type PlacePrediction,
  usePlacesAutocomplete,
} from "./usePlacesAutocomplete";

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
};

const createRawPrediction = (placeId: string, description: string) => ({
  placeId,
  text: { text: description },
  mainText: { text: description },
  secondaryText: { text: "대한민국" },
  toPlace: jest.fn(),
});

const createPlace = (lat: number, lng: number) => ({
  fetchFields: jest.fn().mockResolvedValue(undefined),
  location: { lat: () => lat, lng: () => lng },
  viewport: {
    getNorthEast: () => ({ lat: () => lat + 0.1, lng: () => lng + 0.1 }),
    getSouthWest: () => ({ lat: () => lat - 0.1, lng: () => lng - 0.1 }),
  },
});

describe("usePlacesAutocomplete", () => {
  const originalGoogle = window.google;

  beforeEach(() => {
    jest.useFakeTimers();

    const fetchAutocompleteSuggestions = jest.fn();
    (window as any).google = {
      maps: {
        Map: function Map() {},
        places: {
          AutocompleteSessionToken: function AutocompleteSessionToken() {},
          AutocompleteSuggestion: { fetchAutocompleteSuggestions },
        },
      },
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    (window as any).google = originalGoogle;
  });

  it("ignores an older autocomplete response after newer input is submitted", async () => {
    const first = createDeferred<{ suggestions: any[] }>();
    const second = createDeferred<{ suggestions: any[] }>();
    jest
      .mocked(
        (window.google.maps.places as any).AutocompleteSuggestion
          .fetchAutocompleteSuggestions,
      )
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const firstPrediction = createRawPrediction("seoul", "서울");
    const secondPrediction = createRawPrediction("busan", "부산");

    const { result } = renderHook(() => usePlacesAutocomplete());

    act(() => result.current.startNewSession());
    await waitFor(() => expect(result.current.isGoogleLoaded).toBe(true));

    act(() => {
      result.current.handleInputChange("Seoul");
      jest.advanceTimersByTime(250);
    });
    act(() => {
      result.current.handleInputChange("Busan");
      jest.advanceTimersByTime(250);
    });

    await act(async () => {
      second.resolve({ suggestions: [{ placePrediction: secondPrediction }] });
      first.resolve({ suggestions: [{ placePrediction: firstPrediction }] });
      await Promise.all([second.promise, first.promise]);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.suggestions).toEqual([
        {
          placeId: "busan",
          description: "부산",
          mainText: "부산",
          secondaryText: "대한민국",
        },
      ]),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("keeps a newer visible suggestion paired with its own raw prediction", async () => {
    const first = createDeferred<{ suggestions: any[] }>();
    const second = createDeferred<{ suggestions: any[] }>();
    jest
      .mocked(
        (window.google.maps.places as any).AutocompleteSuggestion
          .fetchAutocompleteSuggestions,
      )
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const firstPrediction = createRawPrediction("seoul", "서울");
    const secondPrediction = createRawPrediction("busan", "부산");
    const firstPlace = createPlace(37.5665, 126.978);
    const secondPlace = createPlace(35.1796, 129.0756);
    firstPrediction.toPlace.mockReturnValue(firstPlace);
    secondPrediction.toPlace.mockReturnValue(secondPlace);

    const { result } = renderHook(() => usePlacesAutocomplete());
    act(() => result.current.startNewSession());
    await waitFor(() => expect(result.current.isGoogleLoaded).toBe(true));

    act(() => {
      result.current.handleInputChange("Seoul");
      jest.advanceTimersByTime(250);
      result.current.handleInputChange("Busan");
      jest.advanceTimersByTime(250);
    });

    await act(async () => {
      second.resolve({ suggestions: [{ placePrediction: secondPrediction }] });
      await second.promise;
    });
    await waitFor(() =>
      expect(result.current.suggestions[0]?.placeId).toBe("busan"),
    );

    await act(async () => {
      first.resolve({ suggestions: [{ placePrediction: firstPrediction }] });
      await first.promise;
    });
    await act(async () => {
      await result.current.handlePlaceSelect(result.current.suggestions[0]);
    });

    expect(firstPrediction.toPlace).not.toHaveBeenCalled();
    expect(secondPrediction.toPlace).toHaveBeenCalledTimes(1);
    expect(result.current.selectedPlace).toMatchObject({
      placeId: "busan",
      lat: 35.1796,
      lng: 129.0756,
    });
  });

  it("remains mounted after React StrictMode replays effects", async () => {
    const autocomplete = createDeferred<{ suggestions: any[] }>();
    const rawPrediction = createRawPrediction("seoul", "서울");
    jest
      .mocked(
        (window.google.maps.places as any).AutocompleteSuggestion
          .fetchAutocompleteSuggestions,
      )
      .mockReturnValue(autocomplete.promise);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children);

    const { result } = renderHook(() => usePlacesAutocomplete(), { wrapper });
    act(() => result.current.startNewSession());
    await waitFor(() => expect(result.current.isGoogleLoaded).toBe(true));

    act(() => {
      result.current.handleInputChange("Seoul");
      jest.advanceTimersByTime(250);
    });
    await act(async () => {
      autocomplete.resolve({ suggestions: [{ placePrediction: rawPrediction }] });
      await autocomplete.promise;
    });

    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
  });

  it("does not commit place details after a newer input invalidates the selection", async () => {
    const autocomplete = createDeferred<{ suggestions: any[] }>();
    const details = createDeferred<void>();
    const place = {
      fetchFields: jest.fn(() => details.promise),
      location: { lat: () => 37.5, lng: () => 127 },
      viewport: {
        getNorthEast: () => ({ lat: () => 37.7, lng: () => 127.1 }),
        getSouthWest: () => ({ lat: () => 37.4, lng: () => 126.8 }),
      },
    };
    const rawPrediction = createRawPrediction("seoul", "서울");
    rawPrediction.toPlace.mockReturnValue(place);
    const fetchAutocompleteSuggestions = jest.mocked(
      (window.google.maps.places as any).AutocompleteSuggestion
        .fetchAutocompleteSuggestions,
    );
    fetchAutocompleteSuggestions.mockReturnValue(autocomplete.promise);
    const onPlaceSelect = jest.fn();

    const { result } = renderHook(() =>
      usePlacesAutocomplete({ onPlaceSelect }),
    );

    act(() => result.current.startNewSession());
    await waitFor(() => expect(result.current.isGoogleLoaded).toBe(true));
    act(() => {
      result.current.handleInputChange("Seoul");
      jest.advanceTimersByTime(250);
    });
    await act(async () => {
      autocomplete.resolve({ suggestions: [{ placePrediction: rawPrediction }] });
      await autocomplete.promise;
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const prediction: PlacePrediction = {
      placeId: "seoul",
      description: "서울",
      mainText: "서울",
      secondaryText: "대한민국",
    };
    await act(async () => {
      void result.current.handlePlaceSelect(prediction);
    });

    act(() => {
      result.current.handleInputChange("Busan");
    });
    await act(async () => {
      details.resolve();
      await details.promise;
    });

    expect(result.current.selectedPlace).toBeNull();
    expect(onPlaceSelect).not.toHaveBeenCalled();
  });

  it("keeps URL hydration and reset lazy until the first explicit session", async () => {
    const { result } = renderHook(() => usePlacesAutocomplete());

    act(() => {
      result.current.handleInputChange("서울");
      jest.advanceTimersByTime(250);
      result.current.reset();
    });

    expect(result.current.isGoogleLoaded).toBe(false);

    await act(async () => {
      result.current.startNewSession();
      await Promise.resolve();
    });

    expect(result.current.isGoogleLoaded).toBe(true);
  });
});
