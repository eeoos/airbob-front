import { act, renderHook, waitFor } from "@testing-library/react";
import { useGoogleMapsScript } from "./useGoogleMapsScript";

const originalGoogle = window.google;
const originalApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const mapsScripts = () =>
  Array.from(
    document.querySelectorAll<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    )
  );

const setGoogleMapsReady = () => {
  (window as any).google = {
    maps: {
      Map: function Map() {},
    },
  };
};

describe("useGoogleMapsScript", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete (window as any).google;
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY = "test-api-key";
    mapsScripts().forEach((script) => script.remove());
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    mapsScripts().forEach((script) => script.remove());
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY = originalApiKey;
    (window as any).google = originalGoogle;
  });

  it("adds one script tag across multiple hook instances", async () => {
    const first = renderHook(() => useGoogleMapsScript());
    const second = renderHook(() => useGoogleMapsScript());

    await waitFor(() => {
      expect(mapsScripts()).toHaveLength(1);
    });

    expect(first.result.current.status).toBe("loading");
    expect(second.result.current.status).toBe("loading");
    expect(mapsScripts()[0].src).toContain("key=test-api-key");
  });

  it("reports missing-key and does not append a script when api key is empty", async () => {
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY = "";

    const { result } = renderHook(() => useGoogleMapsScript());

    await waitFor(() => {
      expect(result.current.status).toBe("missing-key");
    });

    expect(result.current.isLoaded).toBe(false);
    expect(mapsScripts()).toHaveLength(0);
  });

  it("reports loaded when window.google.maps.Map already exists", async () => {
    setGoogleMapsReady();

    const { result } = renderHook(() => useGoogleMapsScript());

    await waitFor(() => {
      expect(result.current.status).toBe("loaded");
    });

    expect(result.current.isLoaded).toBe(true);
    expect(mapsScripts()).toHaveLength(0);
  });

  it("updates status to error when the script fails to load", async () => {
    const { result } = renderHook(() => useGoogleMapsScript());

    await waitFor(() => {
      expect(mapsScripts()).toHaveLength(1);
    });

    act(() => {
      mapsScripts()[0].dispatchEvent(new Event("error"));
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.isLoaded).toBe(false);
  });

  it("does not duplicate an existing script and transitions to loaded when Maps becomes available", async () => {
    const existingScript = document.createElement("script");
    existingScript.src =
      "https://maps.googleapis.com/maps/api/js?key=already-present&libraries=places&loading=async";
    document.head.appendChild(existingScript);

    const { result } = renderHook(() => useGoogleMapsScript());

    await waitFor(() => {
      expect(result.current.status).toBe("loading");
    });
    expect(mapsScripts()).toHaveLength(1);
    expect(mapsScripts()[0]).toBe(existingScript);

    act(() => {
      setGoogleMapsReady();
      existingScript.dispatchEvent(new Event("load"));
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.status).toBe("loaded");
    });

    expect(result.current.isLoaded).toBe(true);
    expect(mapsScripts()).toHaveLength(1);
  });
});
