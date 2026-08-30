import { IntegrationError, type IntegrationErrorCode } from "./errors";
import { getGoogleMapsApi } from "./googleMaps";

const READINESS_INTERVAL_MS = 50;
export const GOOGLE_PLACES_READINESS_TIMEOUT_MS = 5000;

export interface GooglePlacesPredictionRuntime {
  mainText?: { text: string };
  placeId: string;
  secondaryText?: { text: string };
  text: { text: string };
  toPlace: () => google.maps.places.Place;
}

export interface GooglePlacesRuntime {
  AutocompleteSessionToken: new () => google.maps.places.AutocompleteSessionToken;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (request: {
      input: string;
      language?: string;
      sessionToken: google.maps.places.AutocompleteSessionToken;
    }) => Promise<{
      suggestions: Array<{
        placePrediction: GooglePlacesPredictionRuntime | null;
      }>;
    }>;
  };
}

let activeReadiness: Promise<GooglePlacesRuntime> | null = null;

export const createGooglePlacesIntegrationError = (
  code: IntegrationErrorCode,
) =>
  new IntegrationError({
    code,
    integration: "google-places",
    message: "Google Places runtime is unavailable.",
    retryable: code !== "INTEGRATION_MISSING_CONFIG",
  });

const isGooglePlacesRuntime = (
  value: unknown,
): value is GooglePlacesRuntime => {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<GooglePlacesRuntime>;

  return (
    typeof candidate.AutocompleteSessionToken === "function" &&
    typeof candidate.AutocompleteSuggestion?.fetchAutocompleteSuggestions ===
      "function"
  );
};

export const getGooglePlacesApi = (): GooglePlacesRuntime | null => {
  const places = getGoogleMapsApi()?.places;

  return isGooglePlacesRuntime(places) ? places : null;
};

/**
 * Loads and validates Places only when a feature explicitly starts a session.
 * The shared promise prevents concurrent focus events from importing twice.
 */
export const ensureGooglePlacesReady = (): Promise<GooglePlacesRuntime> => {
  const readyRuntime = getGooglePlacesApi();
  if (readyRuntime) return Promise.resolve(readyRuntime);
  if (activeReadiness) return activeReadiness;
  if (typeof window === "undefined") {
    return Promise.reject(
      createGooglePlacesIntegrationError("INTEGRATION_UNAVAILABLE"),
    );
  }

  const maps = getGoogleMapsApi();
  if (!maps) {
    return Promise.reject(
      createGooglePlacesIntegrationError("INTEGRATION_INVALID_RUNTIME"),
    );
  }

  activeReadiness = new Promise<GooglePlacesRuntime>((resolve, reject) => {
    let settled = false;
    let readinessInterval: number | null = null;
    let readinessTimeout: number | null = null;

    const cleanup = () => {
      if (readinessInterval !== null) {
        window.clearInterval(readinessInterval);
        readinessInterval = null;
      }
      if (readinessTimeout !== null) {
        window.clearTimeout(readinessTimeout);
        readinessTimeout = null;
      }
    };

    const succeedIfReady = () => {
      if (settled) return true;

      const runtime = getGooglePlacesApi();
      if (!runtime) return false;

      settled = true;
      cleanup();
      activeReadiness = null;
      resolve(runtime);
      return true;
    };

    const fail = (code: IntegrationErrorCode) => {
      if (settled) return;

      settled = true;
      cleanup();
      activeReadiness = null;
      reject(createGooglePlacesIntegrationError(code));
    };

    const waitForRuntime = () => {
      if (succeedIfReady()) return;

      if (readinessInterval === null) {
        readinessInterval = window.setInterval(
          succeedIfReady,
          READINESS_INTERVAL_MS,
        );
      }
      if (readinessTimeout === null) {
        readinessTimeout = window.setTimeout(() => {
          if (!succeedIfReady()) fail("INTEGRATION_TIMEOUT");
        }, GOOGLE_PLACES_READINESS_TIMEOUT_MS);
      }
    };

    const importLibrary = (
      maps as typeof google.maps & {
        importLibrary?: (name: "places") => Promise<unknown>;
      }
    ).importLibrary;

    waitForRuntime();

    if (settled || typeof importLibrary !== "function") return;

    void importLibrary.call(maps, "places").then(
      () => waitForRuntime(),
      () => fail("INTEGRATION_LOAD_FAILED"),
    );
  });

  return activeReadiness;
};
