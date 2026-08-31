import { IntegrationError } from "./errors";
import {
  buildGoogleMapsEmbedUrl,
  ensureGoogleMapsScript,
  getGoogleMapsApi,
  GOOGLE_MAPS_READINESS_TIMEOUT_MS,
  requireGoogleMapsApi,
} from "./googleMaps";

const mapsScripts = () =>
  Array.from(document.scripts).filter((script) =>
    script.src.startsWith("https://maps.googleapis.com/maps/api/js"),
  );

const requireMapsScript = (): HTMLScriptElement => {
  const script = mapsScripts().at(0);
  if (!script) throw new Error("Expected the Google Maps script");
  return script;
};

const setGoogleMapsReady = () => {
  (window as any).google = {
    maps: {
      Map: function Map() {},
      places: {},
    },
  };
};

describe("Google Maps platform integration", () => {
  const originalGoogle = window.google;

  beforeEach(() => {
    vi.useFakeTimers();
    delete (window as any).google;
    mapsScripts().forEach((script) => script.remove());
  });

  afterEach(() => {
    mapsScripts().forEach((script) => script.dispatchEvent(new Event("error")));
    mapsScripts().forEach((script) => script.remove());
    vi.clearAllTimers();
    vi.useRealTimers();
    (window as any).google = originalGoogle;
  });

  it("uses the exact HTTPS endpoint and shares one pending promise", async () => {
    const first = ensureGoogleMapsScript("public-browser-key");
    const second = ensureGoogleMapsScript("public-browser-key");
    const script = requireMapsScript();
    const url = new URL(script.src);

    expect(second).toBe(first);
    expect(mapsScripts()).toHaveLength(1);
    expect(url.origin).toBe("https://maps.googleapis.com");
    expect(url.pathname).toBe("/maps/api/js");
    expect(url.searchParams.has("libraries")).toBe(false);
    expect(url.searchParams.get("loading")).toBe("async");
    expect(script.dataset.airbobIntegration).toBe("google-maps-v3");

    setGoogleMapsReady();
    script.dispatchEvent(new Event("load"));
    await expect(first).resolves.toBeUndefined();
  });

  it("adopts one exact existing script and waits for runtime readiness", async () => {
    const existing = document.createElement("script");
    existing.src =
      "https://maps.googleapis.com/maps/api/js?key=already-public&loading=async";
    document.head.appendChild(existing);

    const loading = ensureGoogleMapsScript("already-public");

    expect(mapsScripts()).toEqual([existing]);
    setGoogleMapsReady();
    vi.advanceTimersByTime(50);
    await expect(loading).resolves.toBeUndefined();
  });

  it("replaces scripts with a different key or any extra query contract", async () => {
    const mismatched = document.createElement("script");
    mismatched.src =
      "https://maps.googleapis.com/maps/api/js?key=old-key&libraries=places&loading=async";
    const callbackScript = document.createElement("script");
    callbackScript.src =
      "https://maps.googleapis.com/maps/api/js?key=requested-key&libraries=places&loading=async&callback=initMap";
    document.head.append(mismatched, callbackScript);

    const loading = ensureGoogleMapsScript("requested-key");
    const ownedScript = requireMapsScript();
    const ownedUrl = new URL(ownedScript.src);

    expect(mismatched.isConnected).toBe(false);
    expect(callbackScript.isConnected).toBe(false);
    expect(mapsScripts()).toHaveLength(1);
    expect(ownedUrl.searchParams.get("key")).toBe("requested-key");
    expect(Array.from(ownedUrl.searchParams.keys()).sort()).toEqual([
      "key",
      "loading",
    ]);

    setGoogleMapsReady();
    ownedScript.dispatchEvent(new Event("load"));
    await loading;
  });

  it("removes a failed script and permits a clean retry", async () => {
    const first = ensureGoogleMapsScript("public-browser-key");
    const failedScript = requireMapsScript();

    failedScript.dispatchEvent(new Event("error"));
    await expect(first).rejects.toMatchObject({
      code: "INTEGRATION_LOAD_FAILED",
      integration: "google-maps",
    });
    expect(failedScript.isConnected).toBe(false);

    const retry = ensureGoogleMapsScript("public-browser-key");
    const retryScript = requireMapsScript();
    expect(retryScript).not.toBe(failedScript);

    setGoogleMapsReady();
    retryScript.dispatchEvent(new Event("load"));
    await expect(retry).resolves.toBeUndefined();
  });

  it("times out with safe typed metadata and removes its script", async () => {
    const loading = ensureGoogleMapsScript("never-include-this-key-in-errors");

    vi.advanceTimersByTime(GOOGLE_MAPS_READINESS_TIMEOUT_MS);

    await expect(loading).rejects.toEqual(
      expect.objectContaining({
        code: "INTEGRATION_TIMEOUT",
        integration: "google-maps",
        message: "Google Maps runtime is unavailable.",
      }),
    );
    expect(mapsScripts()).toHaveLength(0);
  });

  it("rejects missing configuration without exposing a key-shaped value", async () => {
    await expect(ensureGoogleMapsScript(" ")).rejects.toBeInstanceOf(
      IntegrationError,
    );
    await expect(ensureGoogleMapsScript(" ")).rejects.toMatchObject({
      code: "INTEGRATION_MISSING_CONFIG",
    });
  });

  it("exposes the validated runtime and builds an encoded embed URL", () => {
    expect(getGoogleMapsApi()).toBeNull();
    expect(() => requireGoogleMapsApi()).toThrow(
      expect.objectContaining({
        code: "INTEGRATION_INVALID_RUNTIME",
        integration: "google-maps",
      }),
    );
    setGoogleMapsReady();
    expect(getGoogleMapsApi()).toBe(window.google.maps);
    expect(requireGoogleMapsApi()).toBe(window.google.maps);

    const embedUrl = buildGoogleMapsEmbedUrl({
      apiKey: "maps key",
      latitude: 37.5512,
      longitude: 126.9882,
      zoom: 15,
    });
    const parsed = new URL(embedUrl!);

    expect(parsed.origin).toBe("https://www.google.com");
    expect(parsed.pathname).toBe("/maps/embed/v1/place");
    expect(parsed.searchParams.get("key")).toBe("maps key");
    expect(parsed.searchParams.get("q")).toBe("37.5512,126.9882");
    expect(parsed.searchParams.get("zoom")).toBe("15");
  });

  it.each([
    [
      "an empty browser key",
      { apiKey: " ", latitude: 37.5, longitude: 127, zoom: 15 },
    ],
    [
      "a non-finite latitude",
      { apiKey: "maps-key", latitude: Number.NaN, longitude: 127, zoom: 15 },
    ],
    [
      "a non-finite longitude",
      {
        apiKey: "maps-key",
        latitude: 37.5,
        longitude: Number.POSITIVE_INFINITY,
        zoom: 15,
      },
    ],
    [
      "a non-finite zoom",
      {
        apiKey: "maps-key",
        latitude: 37.5,
        longitude: 127,
        zoom: Number.NEGATIVE_INFINITY,
      },
    ],
  ])("fails closed when an embed receives %s", (_description, options) => {
    expect(buildGoogleMapsEmbedUrl(options)).toBeNull();
  });
});
