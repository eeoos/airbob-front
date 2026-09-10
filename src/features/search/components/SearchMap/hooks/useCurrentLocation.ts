import { useCallback, useEffect, useRef, useState } from "react";

interface UseCurrentLocationOptions {
  requestKey?: string | undefined;
  onLocation: (center: google.maps.LatLngLiteral) => void;
}

export const useCurrentLocation = ({
  requestKey,
  onLocation,
}: UseCurrentLocationOptions) => {
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestRef = useRef<object | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ requestKey, onLocation });
  latestRef.current = { requestKey, onLocation };

  const discardRequest = useCallback(() => {
    activeRequestRef.current = null;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    discardRequest();
    setIsLocating(false);
    setError(null);
  }, [discardRequest]);

  useEffect(() => {
    cancel();
    return discardRequest;
  }, [cancel, discardRequest, requestKey]);

  const requestLocation = useCallback(() => {
    if (activeRequestRef.current !== null) return;
    setError(null);
    if (!navigator.geolocation || window.isSecureContext === false) {
      setError("이 브라우저에서는 현재 위치를 사용할 수 없습니다.");
      return;
    }

    const token = {};
    const startingKey = latestRef.current.requestKey;
    activeRequestRef.current = token;
    setIsLocating(true);
    const isCurrent = () =>
      activeRequestRef.current === token &&
      latestRef.current.requestKey === startingKey;
    const fail = (message: string) => {
      if (!isCurrent()) return;
      discardRequest();
      setIsLocating(false);
      setError(message);
    };

    // The browser's timeout excludes time spent waiting for permission.
    timerRef.current = setTimeout(() => {
      fail("위치를 확인하지 못했습니다. 다시 시도해 주세요.");
    }, 15000);

    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (!isCurrent()) return;
          if (
            !Number.isFinite(coords.latitude) ||
            !Number.isFinite(coords.longitude) ||
            Math.abs(coords.latitude) > 90 ||
            Math.abs(coords.longitude) > 180
          ) {
            fail("위치를 확인하지 못했습니다. 다시 시도해 주세요.");
            return;
          }
          discardRequest();
          setIsLocating(false);
          latestRef.current.onLocation({
            lat: coords.latitude,
            lng: coords.longitude,
          });
        },
        ({ code }) =>
          fail(
            code === 1
              ? "위치 권한이 꺼져 있습니다. 브라우저 설정에서 허용해 주세요."
              : "위치를 확인하지 못했습니다. 다시 시도해 주세요.",
          ),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    } catch {
      fail("현재 위치를 사용할 수 없습니다. 브라우저 설정을 확인해 주세요.");
    }
  }, [discardRequest]);

  return { isLocating, error, requestLocation, cancel };
};
