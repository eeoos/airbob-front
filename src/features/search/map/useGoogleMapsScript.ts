import { useEffect, useState } from "react";

export type GoogleMapsScriptStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "error"
  | "missing-key";

interface GoogleMapsScriptState {
  isLoaded: boolean;
  status: GoogleMapsScriptStatus;
}

const GOOGLE_MAPS_SCRIPT_SELECTOR =
  'script[src*="maps.googleapis.com/maps/api/js"]';
const GOOGLE_MAPS_API_URL = "https://maps.googleapis.com/maps/api/js";
const READINESS_CHECK_INTERVAL_MS = 50;

let currentStatus: GoogleMapsScriptStatus = "idle";
let readinessTimer: ReturnType<typeof setTimeout> | null = null;
let erroredScript: HTMLScriptElement | null = null;

const listeners = new Set<(status: GoogleMapsScriptStatus) => void>();
const observedScripts = new WeakSet<HTMLScriptElement>();

const isGoogleMapsReady = () =>
  typeof window !== "undefined" &&
  typeof window.google?.maps?.Map === "function";

const findGoogleMapsScript = () =>
  typeof document === "undefined"
    ? null
    : document.querySelector<HTMLScriptElement>(GOOGLE_MAPS_SCRIPT_SELECTOR);

const notifyListeners = () => {
  listeners.forEach((listener) => listener(getStatusSnapshot()));
};

const setStatus = (nextStatus: GoogleMapsScriptStatus) => {
  if (currentStatus === nextStatus) return;

  currentStatus = nextStatus;
  notifyListeners();
};

const clearReadinessTimer = () => {
  if (readinessTimer === null) return;

  clearTimeout(readinessTimer);
  readinessTimer = null;
};

const markLoadedIfReady = () => {
  if (!isGoogleMapsReady()) return false;

  clearReadinessTimer();
  setStatus("loaded");
  return true;
};

const scheduleReadinessCheck = () => {
  if (readinessTimer !== null || currentStatus !== "loading") return;

  readinessTimer = setTimeout(() => {
    readinessTimer = null;

    if (markLoadedIfReady()) return;
    if (listeners.size === 0) return;

    scheduleReadinessCheck();
  }, READINESS_CHECK_INTERVAL_MS);
};

const watchForMapsReadiness = (script?: HTMLScriptElement) => {
  if (markLoadedIfReady()) return;

  if (currentStatus !== "error" || script !== erroredScript) {
    erroredScript = null;
    setStatus("loading");
  }
  scheduleReadinessCheck();
};

const handleScriptLoad = (event: Event) => {
  watchForMapsReadiness(event.currentTarget as HTMLScriptElement);
};

const handleScriptError = (event: Event) => {
  erroredScript = event.currentTarget as HTMLScriptElement;
  clearReadinessTimer();
  setStatus("error");
};

const observeScript = (script: HTMLScriptElement) => {
  if (observedScripts.has(script)) return;

  observedScripts.add(script);
  script.addEventListener("load", handleScriptLoad);
  script.addEventListener("error", handleScriptError);
};

const buildGoogleMapsScriptUrl = (apiKey: string) => {
  const params = new URLSearchParams({
    key: apiKey,
    libraries: "places",
    loading: "async",
  });

  return `${GOOGLE_MAPS_API_URL}?${params.toString()}`;
};

const ensureGoogleMapsScript = () => {
  if (markLoadedIfReady()) return;

  const existingScript = findGoogleMapsScript();
  if (existingScript) {
    observeScript(existingScript);
    watchForMapsReadiness(existingScript);
    return;
  }

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    clearReadinessTimer();
    setStatus("missing-key");
    return;
  }

  const script = document.createElement("script");
  script.src = buildGoogleMapsScriptUrl(apiKey);
  script.async = true;
  script.defer = true;

  erroredScript = null;
  observeScript(script);
  setStatus("loading");
  document.head.appendChild(script);
  scheduleReadinessCheck();
};

const getStatusSnapshot = (): GoogleMapsScriptStatus => {
  if (isGoogleMapsReady()) return "loaded";
  if (currentStatus === "loaded") {
    return findGoogleMapsScript() ? "loading" : "idle";
  }
  return currentStatus;
};

export const useGoogleMapsScript = (): GoogleMapsScriptState => {
  const [status, setHookStatus] =
    useState<GoogleMapsScriptStatus>(getStatusSnapshot);

  useEffect(() => {
    listeners.add(setHookStatus);
    setHookStatus(getStatusSnapshot());
    ensureGoogleMapsScript();

    return () => {
      listeners.delete(setHookStatus);
      if (listeners.size === 0) {
        clearReadinessTimer();
      }
    };
  }, []);

  return {
    isLoaded: status === "loaded",
    status,
  };
};
