import { useEffect, useState } from "react";
import { getPublicRuntimeConfig } from "../platform/config/publicRuntimeConfig";
import {
  ensureGoogleMapsScript,
  getGoogleMapsApi,
} from "../platform/integrations/googleMaps";

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

const getInitialStatus = (): GoogleMapsScriptStatus => {
  if (getGoogleMapsApi()) return "loaded";

  return getPublicRuntimeConfig().googleMapsBrowserKey
    ? "idle"
    : "missing-key";
};

/** React compatibility facade over the platform-owned Google Maps loader. */
export const useGoogleMapsScript = (): GoogleMapsScriptState => {
  const [status, setStatus] =
    useState<GoogleMapsScriptStatus>(getInitialStatus);

  useEffect(() => {
    let isActive = true;

    if (getGoogleMapsApi()) {
      setStatus("loaded");
      return () => {
        isActive = false;
      };
    }

    const apiKey = getPublicRuntimeConfig().googleMapsBrowserKey;
    if (!apiKey) {
      setStatus("missing-key");
      return () => {
        isActive = false;
      };
    }

    setStatus("loading");
    ensureGoogleMapsScript(apiKey).then(
      () => {
        if (isActive) setStatus("loaded");
      },
      () => {
        if (isActive) setStatus("error");
      },
    );

    return () => {
      isActive = false;
    };
  }, []);

  return {
    isLoaded: status === "loaded",
    status,
  };
};
