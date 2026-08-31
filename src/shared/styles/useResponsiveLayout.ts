import { useCallback, useSyncExternalStore } from "react";
import { RESPONSIVE_MEDIA_QUERIES } from "./responsive";

export type ResponsiveLayout = "mobile-tablet" | "desktop";

const canMatchMedia = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

const subscribeToMediaQuery = (query: string, onChange: () => void) => {
  if (!canMatchMedia()) {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(query);
  const handleChange = () => onChange();

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }

  mediaQuery.addListener(handleChange);
  return () => mediaQuery.removeListener(handleChange);
};

export const useResponsiveLayout = (): ResponsiveLayout => {
  const subscribe = useCallback(
    (onChange: () => void) =>
      subscribeToMediaQuery(RESPONSIVE_MEDIA_QUERIES.mobileOrTablet, onChange),
    [],
  );
  const getSnapshot = useCallback(
    () =>
      canMatchMedia() &&
      window.matchMedia(RESPONSIVE_MEDIA_QUERIES.mobileOrTablet).matches,
    [],
  );
  const isMobileOrTablet = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false,
  );

  return isMobileOrTablet ? "mobile-tablet" : "desktop";
};
