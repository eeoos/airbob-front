import { useCallback, useEffect, useRef, useState } from "react";
import { getPublicRuntimeConfig } from "../../../platform/config/publicRuntimeConfig";
import { IntegrationError } from "../../../platform/integrations/errors";
import {
  createGoogleMapsIntegrationError,
  ensureGoogleMapsScript,
} from "../../../platform/integrations/googleMaps";
import {
  createGooglePlacesIntegrationError,
  ensureGooglePlacesReady,
  getGooglePlacesApi,
  type GooglePlacesPredictionRuntime,
  type GooglePlacesRuntime,
} from "../../../platform/integrations/googlePlaces";
import type {
  SearchPlacePrediction,
  SearchSelectedPlace,
} from "../model/search";

export type PlacePrediction = SearchPlacePrediction;
export type SelectedPlace = SearchSelectedPlace;

export interface UsePlacesAutocompleteOptions {
  debounceMs?: number;
  onPlaceSelect?: (place: SelectedPlace) => void;
}

const normalizePlacesError = (cause: unknown) =>
  cause instanceof IntegrationError
    ? cause
    : createGooglePlacesIntegrationError("INTEGRATION_LOAD_FAILED");

const ensureSearchPlacesRuntime = async (): Promise<GooglePlacesRuntime> => {
  const readyRuntime = getGooglePlacesApi();
  if (readyRuntime) return readyRuntime;

  const apiKey = getPublicRuntimeConfig().googleMapsBrowserKey;
  if (!apiKey) {
    throw createGoogleMapsIntegrationError("INTEGRATION_MISSING_CONFIG");
  }

  await ensureGoogleMapsScript(apiKey);
  return ensureGooglePlacesReady();
};

export const usePlacesAutocomplete = ({
  debounceMs = 250,
  onPlaceSelect,
}: UsePlacesAutocompleteOptions = {}) => {
  const [inputText, setInputText] = useState("");
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [error, setError] = useState<IntegrationError | null>(null);
  const [placesRequested, setPlacesRequested] = useState(false);
  const [placesSessionVersion, setPlacesSessionVersion] = useState(0);

  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placesRuntimeRef = useRef<GooglePlacesRuntime | null>(null);
  const rawSuggestionsRef = useRef<
    Map<string, GooglePlacesPredictionRuntime>
  >(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputTextRef = useRef("");
  const placesRequestedRef = useRef(false);
  const requestVersionRef = useRef(0);
  const isMountedRef = useRef(true);

  const searchAutocomplete = useCallback(
    async (
      input: string,
      requestVersion: number,
      readyRuntime?: GooglePlacesRuntime,
    ) => {
      if (
        !isMountedRef.current ||
        requestVersion !== requestVersionRef.current
      ) {
        return;
      }

      const normalizedInput = input.trim();
      if (!normalizedInput || !placesRequestedRef.current) {
        setSuggestions([]);
        rawSuggestionsRef.current.clear();
        setIsLoading(false);
        return;
      }

      const places =
        readyRuntime ?? placesRuntimeRef.current ?? getGooglePlacesApi();
      if (!places) {
        setIsLoading(false);
        return;
      }

      placesRuntimeRef.current = places;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new places.AutocompleteSessionToken();
      }

      const sessionToken = sessionTokenRef.current;
      setIsLoading(true);

      try {
        const { suggestions: rawSuggestions } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: normalizedInput,
            sessionToken,
            language: "ko",
          });

        const nextRawSuggestions = new Map<
          string,
          GooglePlacesPredictionRuntime
        >();
        const formatted: PlacePrediction[] = [];

        for (const suggestion of rawSuggestions) {
          const prediction = suggestion.placePrediction;
          if (!prediction) continue;

          nextRawSuggestions.set(prediction.placeId, prediction);
          formatted.push({
            placeId: prediction.placeId,
            description: prediction.text.text,
            mainText: prediction.mainText?.text ?? prediction.text.text,
            secondaryText: prediction.secondaryText?.text ?? "",
          });
        }

        if (
          isMountedRef.current &&
          requestVersion === requestVersionRef.current
        ) {
          rawSuggestionsRef.current = nextRawSuggestions;
          setSuggestions(formatted);
          setError(null);
        }
      } catch (cause: unknown) {
        if (
          !isMountedRef.current ||
          requestVersion !== requestVersionRef.current
        ) {
          return;
        }

        rawSuggestionsRef.current.clear();
        setSuggestions([]);
        setError(normalizePlacesError(cause));
      } finally {
        if (
          isMountedRef.current &&
          requestVersion === requestVersionRef.current
        ) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const startNewSession = useCallback(() => {
    placesRequestedRef.current = true;
    setPlacesRequested(true);
    setPlacesSessionVersion((version) => version + 1);
    setError(null);

    const places = placesRuntimeRef.current ?? getGooglePlacesApi();
    if (!places) {
      sessionTokenRef.current = null;
      return;
    }

    placesRuntimeRef.current = places;
    sessionTokenRef.current = new places.AutocompleteSessionToken();
    setIsGoogleLoaded(true);
  }, []);

  useEffect(() => {
    if (!placesRequested) return;

    let isActive = true;
    const hadReadyRuntime = placesRuntimeRef.current !== null;

    void ensureSearchPlacesRuntime().then(
      (places) => {
        if (!isActive || !isMountedRef.current) return;

        placesRuntimeRef.current = places;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new places.AutocompleteSessionToken();
        }
        setIsGoogleLoaded(true);
        setError(null);

        const latestInput = inputTextRef.current;
        if (hadReadyRuntime || !latestInput.trim()) return;

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        void searchAutocomplete(
          latestInput,
          requestVersionRef.current,
          places,
        );
      },
      (cause: unknown) => {
        if (!isActive || !isMountedRef.current) return;

        setIsGoogleLoaded(false);
        setIsLoading(false);
        setError(normalizePlacesError(cause));
      },
    );

    return () => {
      isActive = false;
    };
  }, [placesRequested, placesSessionVersion, searchAutocomplete]);

  const handleInputChange = useCallback(
    (value: string) => {
      const requestVersion = ++requestVersionRef.current;
      inputTextRef.current = value;
      setInputText(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!value.trim()) {
        setSuggestions([]);
        rawSuggestionsRef.current.clear();
        setIsLoading(false);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void searchAutocomplete(value, requestVersion);
      }, debounceMs);
    },
    [debounceMs, searchAutocomplete],
  );

  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<SelectedPlace> => {
      const raw = rawSuggestionsRef.current.get(placeId);
      if (!raw) {
        throw createGooglePlacesIntegrationError(
          "INTEGRATION_INVALID_RUNTIME",
        );
      }

      try {
        const place = raw.toPlace();
        await place.fetchFields({ fields: ["location", "viewport"] });

        const location = place.location;
        const viewport = place.viewport;

        if (!location || !viewport) {
          throw createGooglePlacesIntegrationError(
            "INTEGRATION_INVALID_RUNTIME",
          );
        }

        return {
          placeId,
          lat: location.lat(),
          lng: location.lng(),
          viewport: {
            north: viewport.getNorthEast().lat(),
            south: viewport.getSouthWest().lat(),
            east: viewport.getNorthEast().lng(),
            west: viewport.getSouthWest().lng(),
          },
        };
      } catch (cause: unknown) {
        throw normalizePlacesError(cause);
      }
    },
    [],
  );

  const handlePlaceSelect = useCallback(
    async (prediction: PlacePrediction) => {
      const requestVersion = ++requestVersionRef.current;

      try {
        setIsLoading(true);
        const place = await getPlaceDetails(prediction.placeId);

        if (
          !isMountedRef.current ||
          requestVersion !== requestVersionRef.current
        ) {
          return;
        }

        setSelectedPlace(place);
        setInputText(prediction.description);
        inputTextRef.current = prediction.description;
        setSuggestions([]);
        rawSuggestionsRef.current.clear();
        setError(null);

        const places = placesRuntimeRef.current;
        sessionTokenRef.current = places
          ? new places.AutocompleteSessionToken()
          : null;
        onPlaceSelect?.(place);
      } catch (cause: unknown) {
        if (
          !isMountedRef.current ||
          requestVersion !== requestVersionRef.current
        ) {
          return;
        }

        setError(normalizePlacesError(cause));
      } finally {
        if (
          isMountedRef.current &&
          requestVersion === requestVersionRef.current
        ) {
          setIsLoading(false);
        }
      }
    },
    [getPlaceDetails, onPlaceSelect],
  );

  const clearSuggestions = useCallback(() => {
    requestVersionRef.current += 1;
    setSuggestions([]);
    rawSuggestionsRef.current.clear();
  }, []);

  const reset = useCallback(() => {
    requestVersionRef.current += 1;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    inputTextRef.current = "";
    sessionTokenRef.current = null;
    setInputText("");
    setSuggestions([]);
    setSelectedPlace(null);
    setIsLoading(false);
    setError(null);
    rawSuggestionsRef.current.clear();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      requestVersionRef.current += 1;
      sessionTokenRef.current = null;
      rawSuggestionsRef.current.clear();

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  return {
    inputText,
    suggestions,
    isLoading,
    selectedPlace,
    isGoogleLoaded,
    error,
    handleInputChange,
    handlePlaceSelect,
    clearSuggestions,
    reset,
    startNewSession,
  };
};
