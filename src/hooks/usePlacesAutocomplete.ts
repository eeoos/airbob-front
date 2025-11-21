import { useState, useEffect, useRef, useCallback } from "react";
import { GOOGLE_MAPS_API_KEY } from "../utils/constants";

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

export const usePlacesAutocomplete = ({
  debounceMs = 250,
  onPlaceSelect,
}: UsePlacesAutocompleteOptions = {}) => {
  const [inputText, setInputText] = useState("");
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false); // 서비스 초기화 여부 추적

  // Google Maps API 로드 확인 및 초기화
  useEffect(() => {
    const checkGoogleLoaded = () => {
      return !!(
        window.google &&
        window.google.maps &&
        window.google.maps.places &&
        window.google.maps.places.AutocompleteService
      );
    };

    if (checkGoogleLoaded()) {
      initializeServices();
      setIsGoogleLoaded(true);
      return;
    }

    // 이미 스크립트가 로드 중인지 확인
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (checkGoogleLoaded()) {
          initializeServices();
          setIsGoogleLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // Google Maps API 스크립트 로드
    if (GOOGLE_MAPS_API_KEY) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        const checkInterval = setInterval(() => {
          if (checkGoogleLoaded()) {
            initializeServices();
            setIsGoogleLoaded(true);
            clearInterval(checkInterval);
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          if (!checkGoogleLoaded()) {
            console.error("Google Maps Places API를 사용할 수 없습니다.");
          }
        }, 5000);
      };
      script.onerror = () => {
        console.error("Google Maps API 로드 실패");
      };
      document.head.appendChild(script);
    } else {
      console.warn("Google Maps API 키가 설정되지 않았습니다.");
    }
  }, []);

  // 서비스 초기화 (한 번만 실행)
  const initializeServices = useCallback(() => {
    if (!window.google?.maps?.places) return;
    
    // 이미 초기화되었으면 중복 초기화 방지
    if (isInitializedRef.current && autocompleteServiceRef.current && placesServiceRef.current) {
      return;
    }

    // 새 세션 토큰 생성
    sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    
    // AutocompleteService 초기화 (한 번만)
    if (!autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    }
    
    // PlacesService 초기화 (Place Details API용, 한 번만)
    if (!placesServiceRef.current) {
      const dummyDiv = document.createElement("div");
      placesServiceRef.current = new window.google.maps.places.PlacesService(dummyDiv);
    }
    
    isInitializedRef.current = true;
  }, []);

  // 새 세션 시작 (입력 필드 포커스 시)
  const startNewSession = useCallback(() => {
    if (window.google?.maps?.places) {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  }, []);

  // 자동완성 검색
  const searchAutocomplete = useCallback(
    (input: string) => {
      if (!autocompleteServiceRef.current || !sessionTokenRef.current || !input.trim()) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);

      const request: google.maps.places.AutocompletionRequest = {
        input: input.trim(),
        sessionToken: sessionTokenRef.current,
        language: "ko",
      };

      autocompleteServiceRef.current.getPlacePredictions(
        request,
        (predictions, status) => {
          setIsLoading(false);
          
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            const formattedPredictions: PlacePrediction[] = predictions.map((pred) => ({
              placeId: pred.place_id,
              description: pred.description,
              mainText: pred.structured_formatting.main_text,
              secondaryText: pred.structured_formatting.secondary_text || "",
            }));
            setSuggestions(formattedPredictions);
          } else {
            setSuggestions([]);
          }
        }
      );
    },
    []
  );

  // Debounce 처리된 입력 핸들러
  const handleInputChange = useCallback(
    (value: string) => {
      setInputText(value);
      
      // 이전 타이머 클리어
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 새 타이머 설정
      debounceTimerRef.current = setTimeout(() => {
        searchAutocomplete(value);
      }, debounceMs);
    },
    [debounceMs, searchAutocomplete]
  );

  // Place Details API 호출 (Basic Details만)
  const getPlaceDetails = useCallback(
    (placeId: string): Promise<SelectedPlace> => {
      return new Promise((resolve, reject) => {
        if (!placesServiceRef.current || !sessionTokenRef.current) {
          reject(new Error("Places Service가 초기화되지 않았습니다."));
          return;
        }

        const request: google.maps.places.PlaceDetailsRequest = {
          placeId,
          sessionToken: sessionTokenRef.current,
          fields: ["geometry.location", "geometry.viewport"],
          language: "ko",
        };

        placesServiceRef.current.getDetails(request, (place, status) => {
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            place &&
            place.geometry
          ) {
            const location = place.geometry.location;
            const viewport = place.geometry.viewport;

            if (!location || !viewport) {
              reject(new Error("위치 정보를 가져올 수 없습니다."));
              return;
            }

            // Google Maps LatLng 객체 처리
            // location은 google.maps.LatLng 타입입니다
            const latLng = location as google.maps.LatLng;
            const lat = latLng.lat();
            const lng = latLng.lng();

            // Google Maps LatLngBounds 객체 처리
            // viewport는 google.maps.LatLngBounds 타입입니다
            const boundsObj = viewport as google.maps.LatLngBounds;
            const bounds = {
              north: boundsObj.getNorthEast().lat(),
              south: boundsObj.getSouthWest().lat(),
              east: boundsObj.getNorthEast().lng(),
              west: boundsObj.getSouthWest().lng(),
            };

            const selectedPlace: SelectedPlace = {
              placeId,
              lat: Number(lat),
              lng: Number(lng),
              viewport: bounds,
            };

            resolve(selectedPlace);
          } else {
            reject(new Error(`Place Details API 오류: ${status}`));
          }
        });
      });
    },
    []
  );

  // 장소 선택 핸들러
  const handlePlaceSelect = useCallback(
    async (prediction: PlacePrediction) => {
      try {
        setIsLoading(true);
        const place = await getPlaceDetails(prediction.placeId);
        
        setSelectedPlace(place);
        setInputText(prediction.description);
        setSuggestions([]);
        
        // 새 세션 시작 (다음 입력을 위해)
        startNewSession();
        
        // 콜백 호출
        if (onPlaceSelect) {
          onPlaceSelect(place);
        }
      } catch (error) {
        console.error("Place Details API 오류:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [getPlaceDetails, onPlaceSelect, startNewSession]
  );

  // 추천 리스트 닫기
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  // 모든 상태 초기화
  const reset = useCallback(() => {
    setInputText("");
    setSuggestions([]);
    setSelectedPlace(null);
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

