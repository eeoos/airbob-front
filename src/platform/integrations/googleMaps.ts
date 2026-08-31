import { IntegrationError, type IntegrationErrorCode } from "./errors";

const GOOGLE_MAPS_ORIGIN = "https://maps.googleapis.com";
const GOOGLE_MAPS_PATH = "/maps/api/js";
const GOOGLE_MAPS_SCRIPT_URL = `${GOOGLE_MAPS_ORIGIN}${GOOGLE_MAPS_PATH}`;
const GOOGLE_MAPS_SCRIPT_MARKER = "google-maps-v3";
const READINESS_INTERVAL_MS = 50;
export const GOOGLE_MAPS_READINESS_TIMEOUT_MS = 5000;

interface GoogleMapsLoadAttempt {
  fail: (error: IntegrationError) => void;
  promise: Promise<void>;
  script: HTMLScriptElement;
}

let activeAttempt: GoogleMapsLoadAttempt | null = null;

export const createGoogleMapsIntegrationError = (code: IntegrationErrorCode) =>
  new IntegrationError({
    code,
    integration: "google-maps",
    message: "Google Maps runtime is unavailable.",
    retryable: code !== "INTEGRATION_MISSING_CONFIG",
  });

const parseGoogleMapsScriptUrl = (script: HTMLScriptElement): URL | null => {
  try {
    const url = new URL(script.src);

    return url.origin === GOOGLE_MAPS_ORIGIN &&
      url.pathname === GOOGLE_MAPS_PATH
      ? url
      : null;
  } catch {
    return null;
  }
};

const isAdoptableGoogleMapsScript = (
  script: HTMLScriptElement,
  requestedApiKey: string,
) => {
  const url = parseGoogleMapsScriptUrl(script);
  if (!url) return false;

  const queryKeys = Array.from(url.searchParams.keys());
  const allowedQueryKeys = new Set(["key", "loading"]);

  return (
    !url.username &&
    !url.password &&
    !url.hash &&
    queryKeys.length === 2 &&
    new Set(queryKeys).size === 2 &&
    queryKeys.every((key) => allowedQueryKeys.has(key)) &&
    url.searchParams.get("key") === requestedApiKey &&
    url.searchParams.get("loading") === "async"
  );
};

const getGoogleMapsScripts = () =>
  typeof document === "undefined"
    ? []
    : Array.from(
        document.querySelectorAll<HTMLScriptElement>("script[src]"),
      ).filter((script) => parseGoogleMapsScriptUrl(script) !== null);

export const getGoogleMapsApi = (): typeof google.maps | null => {
  if (typeof window === "undefined") return null;

  const maps = window.google?.maps;
  return maps && typeof maps.Map === "function" ? maps : null;
};

export const requireGoogleMapsApi = (): typeof google.maps => {
  const maps = getGoogleMapsApi();

  if (!maps) {
    throw createGoogleMapsIntegrationError("INTEGRATION_INVALID_RUNTIME");
  }

  return maps;
};

const buildGoogleMapsScriptUrl = (apiKey: string) => {
  const url = new URL(GOOGLE_MAPS_SCRIPT_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("loading", "async");

  return url.toString();
};

const createLoadAttempt = (
  script: HTMLScriptElement,
): GoogleMapsLoadAttempt => {
  let resolvePromise!: () => void;
  let rejectPromise!: (error: IntegrationError) => void;
  let settled = false;
  let readinessInterval: number | null = null;
  let readinessTimeout: number | null = null;

  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const cleanup = () => {
    script.removeEventListener("load", handleLoad);
    script.removeEventListener("error", handleError);
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
    if (settled || !getGoogleMapsApi()) return false;

    settled = true;
    cleanup();
    activeAttempt = null;
    resolvePromise();
    return true;
  };

  const fail = (error: IntegrationError) => {
    if (settled) return;

    settled = true;
    cleanup();
    if (script.isConnected) script.remove();
    activeAttempt = null;
    rejectPromise(error);
  };

  function handleLoad() {
    succeedIfReady();
  }

  function handleError() {
    fail(createGoogleMapsIntegrationError("INTEGRATION_LOAD_FAILED"));
  }

  script.addEventListener("load", handleLoad);
  script.addEventListener("error", handleError);
  readinessInterval = window.setInterval(succeedIfReady, READINESS_INTERVAL_MS);
  readinessTimeout = window.setTimeout(() => {
    if (succeedIfReady()) return;
    fail(createGoogleMapsIntegrationError("INTEGRATION_TIMEOUT"));
  }, GOOGLE_MAPS_READINESS_TIMEOUT_MS);

  return {
    fail,
    promise,
    script,
  };
};

export const ensureGoogleMapsScript = (apiKey: string): Promise<void> => {
  const normalizedApiKey = apiKey.trim();
  if (!normalizedApiKey) {
    return Promise.reject(
      createGoogleMapsIntegrationError("INTEGRATION_MISSING_CONFIG"),
    );
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      createGoogleMapsIntegrationError("INTEGRATION_UNAVAILABLE"),
    );
  }
  if (getGoogleMapsApi()) return Promise.resolve();

  if (activeAttempt) {
    if (activeAttempt.script.isConnected) return activeAttempt.promise;

    activeAttempt.fail(
      createGoogleMapsIntegrationError("INTEGRATION_DISCONNECTED"),
    );
  }

  const scripts = getGoogleMapsScripts();
  const adoptableScript =
    scripts.find((script) =>
      isAdoptableGoogleMapsScript(script, normalizedApiKey),
    ) ?? null;

  scripts.forEach((script) => {
    if (script !== adoptableScript) script.remove();
  });

  const script = adoptableScript ?? document.createElement("script");
  script.dataset.airbobIntegration = GOOGLE_MAPS_SCRIPT_MARKER;
  script.async = true;
  script.defer = true;

  if (!adoptableScript) {
    script.src = buildGoogleMapsScriptUrl(normalizedApiKey);
  }

  const attempt = createLoadAttempt(script);
  activeAttempt = attempt;

  if (!script.isConnected) document.head.appendChild(script);

  return attempt.promise;
};

interface GoogleMapsEmbedUrlOptions {
  apiKey: string;
  latitude: number;
  longitude: number;
  zoom?: number;
}

export const buildGoogleMapsEmbedUrl = ({
  apiKey,
  latitude,
  longitude,
  zoom = 15,
}: GoogleMapsEmbedUrlOptions): string | null => {
  const normalizedApiKey = apiKey.trim();
  if (
    !normalizedApiKey ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(zoom)
  ) {
    return null;
  }

  const url = new URL("https://www.google.com/maps/embed/v1/place");
  url.searchParams.set("key", normalizedApiKey);
  url.searchParams.set("q", `${latitude},${longitude}`);
  url.searchParams.set("zoom", String(zoom));

  return url.toString();
};
