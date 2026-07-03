import { useState, useEffect, useRef, useCallback } from "react";
import { useGoogleMapsScript } from "./useGoogleMapsScript";

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface SelectedPlace {
  placeId: string;
  lat: number;
  lng: number;
  viewport: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface UsePlacesAutocompleteOptions {
  debounceMs?: number;
  onPlaceSelect?: (place: SelectedPlace) => void;
}

// Places API (New)의 정확한 런타임 타입이 @types/google.maps 버전에 따라 누락될 수 있어
// 부분적으로 느슨한 타입을 사용한다.
type NewPlacePrediction = {
  placeId: string;
  text: { text: string };
  mainText?: { text: string };
  secondaryText?: { text: string };
  toPlace: () => google.maps.places.Place;
};

type NewAutocompleteSuggestion = {
  placePrediction: NewPlacePrediction | null;
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
  const { status: googleMapsScriptStatus } = useGoogleMapsScript();

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  // 세션 토큰이 자동 첨부되는 toPlace() 흐름을 살리기 위해 raw suggestion을 보관한다.
  const rawSuggestionsRef = useRef<Map<string, NewPlacePrediction>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // 새 세션 시작 (입력 필드 포커스 시)
  const startNewSession = useCallback(() => {
    if (typeof window.google?.maps?.places?.AutocompleteSessionToken === "function") {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  }, []);

  const isPlacesNewLoaded = useCallback(() => {
    return !!(
      window.google &&
      window.google.maps &&
      window.google.maps.places &&
      typeof window.google.maps.places.AutocompleteSessionToken === "function" &&
      // Places API (New)의 진입 클래스
      (window.google.maps.places as unknown as { AutocompleteSuggestion?: unknown })
        .AutocompleteSuggestion
    );
  }, []);

  const initializeServices = useCallback(() => {
    if (isInitializedRef.current) return;
    if (!isPlacesNewLoaded()) return;

    sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    isInitializedRef.current = true;
    setIsGoogleLoaded(true);
  }, [isPlacesNewLoaded]);

  // Google Maps API 로드 확인 및 초기화
  useEffect(() => {
    if (isPlacesNewLoaded()) {
      initializeServices();
      return;
    }

    setIsGoogleLoaded(false);

    if (googleMapsScriptStatus === "missing-key") {
      console.warn("Google Maps API 키가 설정되지 않았습니다.");
      return;
    }

    if (googleMapsScriptStatus === "error") {
      console.error("Google Maps API 로드 실패");
      return;
    }

    if (googleMapsScriptStatus !== "loaded") {
      return;
    }

    const checkInterval = setInterval(() => {
      if (!isPlacesNewLoaded()) return;

      initializeServices();
      clearInterval(checkInterval);
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(checkInterval);

      if (!isPlacesNewLoaded()) {
        console.error("Google Maps Places API (New)를 사용할 수 없습니다.");
      }
    }, 5000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, [googleMapsScriptStatus, initializeServices, isPlacesNewLoaded]);

  // 자동완성 검색 (Places API New)
  const searchAutocomplete = useCallback(async (input: string) => {
    if (!sessionTokenRef.current || !input.trim()) {
      setSuggestions([]);
      rawSuggestionsRef.current.clear();
      return;
    }

    const placesNs = window.google?.maps?.places as unknown as {
      AutocompleteSuggestion?: {
        fetchAutocompleteSuggestions: (request: {
          input: string;
          sessionToken: google.maps.places.AutocompleteSessionToken;
          language?: string;
        }) => Promise<{ suggestions: NewAutocompleteSuggestion[] }>;
      };
    };

    if (!placesNs?.AutocompleteSuggestion) {
      console.error("AutocompleteSuggestion이 로드되지 않았습니다.");
      setSuggestions([]);
      return;
    }

    setIsLoading(true);

    try {
      const { suggestions: rawSuggestions } =
        await placesNs.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: input.trim(),
          sessionToken: sessionTokenRef.current,
          language: "ko",
        });

      rawSuggestionsRef.current.clear();
      const formatted: PlacePrediction[] = [];

      for (const s of rawSuggestions) {
        const p = s.placePrediction;
        if (!p) continue;
        rawSuggestionsRef.current.set(p.placeId, p);
        formatted.push({
          placeId: p.placeId,
          description: p.text.text,
          mainText: p.mainText?.text ?? p.text.text,
          secondaryText: p.secondaryText?.text ?? "",
        });
      }

      setSuggestions(formatted);
    } catch (err) {
      console.error("AutocompleteSuggestion 오류:", err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce 처리된 입력 핸들러
  const handleInputChange = useCallback(
    (value: string) => {
      setInputText(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        searchAutocomplete(value);
      }, debounceMs);
    },
    [debounceMs, searchAutocomplete]
  );

  // Place Details (Place.fetchFields 사용)
  const getPlaceDetails = useCallback(async (placeId: string): Promise<SelectedPlace> => {
    const raw = rawSuggestionsRef.current.get(placeId);
    if (!raw) {
      throw new Error("선택한 장소의 prediction을 찾을 수 없습니다.");
    }

    // toPlace()로 받은 Place 인스턴스는 세션 토큰이 자동 첨부되어 빌링 효율적이다.
    const place = raw.toPlace();
    // 새 API의 필드명: "location", "viewport"
    await place.fetchFields({ fields: ["location", "viewport"] });

    const location = place.location;
    const viewport = place.viewport;

    if (!location || !viewport) {
      throw new Error("위치 정보를 가져올 수 없습니다.");
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
  }, []);

  // 장소 선택 핸들러
  const handlePlaceSelect = useCallback(
    async (prediction: PlacePrediction) => {
      try {
        setIsLoading(true);
        const place = await getPlaceDetails(prediction.placeId);

        setSelectedPlace(place);
        setInputText(prediction.description);
        setSuggestions([]);
        rawSuggestionsRef.current.clear();

        // 새 세션 시작 (다음 입력을 위해)
        startNewSession();

        if (onPlaceSelect) {
          onPlaceSelect(place);
        }
      } catch (error) {
        console.error("Place Details 오류:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [getPlaceDetails, onPlaceSelect, startNewSession]
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    rawSuggestionsRef.current.clear();
  }, []);

  const reset = useCallback(() => {
    setInputText("");
    setSuggestions([]);
    setSelectedPlace(null);
    rawSuggestionsRef.current.clear();
    startNewSession();
  }, [startNewSession]);

  // cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    inputText,
    suggestions,
    isLoading,
    selectedPlace,
    isGoogleLoaded,
    handleInputChange,
    handlePlaceSelect,
    clearSuggestions,
    reset,
    startNewSession,
  };
};
