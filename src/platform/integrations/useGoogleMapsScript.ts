import { useEffect, useState } from "react";
import { getPublicRuntimeConfig } from "../config/publicRuntimeConfig";
import { IntegrationError } from "./errors";
import {
  createGoogleMapsIntegrationError,
  ensureGoogleMapsScript,
  getGoogleMapsApi,
} from "./googleMaps";

type GoogleMapsScriptStatus =
  "idle" | "loading" | "loaded" | "error" | "missing-key";

export interface GoogleMapsScriptState {
  error: IntegrationError | null;
  isLoaded: boolean;
  status: GoogleMapsScriptStatus;
}

export interface UseGoogleMapsScriptOptions {
  enabled?: boolean;
}

const getInitialState = (enabled: boolean): GoogleMapsScriptState => {
  if (getGoogleMapsApi()) {
    return { error: null, isLoaded: true, status: "loaded" };
  }
  if (!enabled) {
    return { error: null, isLoaded: false, status: "idle" };
  }

  const hasKey = Boolean(getPublicRuntimeConfig().googleMapsBrowserKey);

  return hasKey
    ? { error: null, isLoaded: false, status: "idle" }
    : {
        error: createGoogleMapsIntegrationError("INTEGRATION_MISSING_CONFIG"),
        isLoaded: false,
        status: "missing-key",
      };
};

/** React state facade over the platform-owned Google Maps loader. */
export const useGoogleMapsScript = ({
  enabled = true,
}: UseGoogleMapsScriptOptions = {}): GoogleMapsScriptState => {
  const [state, setState] = useState<GoogleMapsScriptState>(() =>
    getInitialState(enabled),
  );

  useEffect(() => {
    let isActive = true;

    if (getGoogleMapsApi()) {
      setState({ error: null, isLoaded: true, status: "loaded" });
      return () => {
        isActive = false;
      };
    }

    if (!enabled) {
      setState({ error: null, isLoaded: false, status: "idle" });
      return () => {
        isActive = false;
      };
    }

    const apiKey = getPublicRuntimeConfig().googleMapsBrowserKey;
    if (!apiKey) {
      setState({
        error: createGoogleMapsIntegrationError("INTEGRATION_MISSING_CONFIG"),
        isLoaded: false,
        status: "missing-key",
      });
      return () => {
        isActive = false;
      };
    }

    setState({ error: null, isLoaded: false, status: "loading" });
    ensureGoogleMapsScript(apiKey).then(
      () => {
        if (isActive) {
          setState({ error: null, isLoaded: true, status: "loaded" });
        }
      },
      (cause: unknown) => {
        if (!isActive) return;

        const error =
          cause instanceof IntegrationError
            ? cause
            : createGoogleMapsIntegrationError("INTEGRATION_LOAD_FAILED");
        setState({ error, isLoaded: false, status: "error" });
      },
    );

    return () => {
      isActive = false;
    };
  }, [enabled]);

  return state;
};
