import { IntegrationError } from "./errors";
import {
  ensureGooglePlacesReady,
  getGooglePlacesApi,
  GOOGLE_PLACES_READINESS_TIMEOUT_MS,
} from "./googlePlaces";

const createPlacesRuntime = () => ({
  AutocompleteSessionToken: function AutocompleteSessionToken() {},
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: jest.fn(),
  },
});

const installMapsRuntime = (importLibrary?: jest.Mock) => {
  (window as any).google = {
    maps: {
      Map: function Map() {},
      importLibrary,
    },
  };
};

describe("Google Places platform integration", () => {
  const originalGoogle = window.google;

  beforeEach(() => {
    jest.useFakeTimers();
    delete (window as any).google;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    (window as any).google = originalGoogle;
  });

  it("returns an already validated runtime without importing again", async () => {
    const importLibrary = jest.fn();
    const places = createPlacesRuntime();
    installMapsRuntime(importLibrary);
    (window as any).google.maps.places = places;

    expect(getGooglePlacesApi()).toBe(places);
    await expect(ensureGooglePlacesReady()).resolves.toBe(places);
    expect(importLibrary).not.toHaveBeenCalled();
  });

  it("does not expose Places on top of an invalid Maps runtime", () => {
    (window as any).google = {
      maps: { places: createPlacesRuntime() },
    };

    expect(getGooglePlacesApi()).toBeNull();
  });

  it("shares one lazy import across concurrent readiness callers", async () => {
    let resolveImport!: () => void;
    const importLibrary = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveImport = resolve;
        }),
    );
    installMapsRuntime(importLibrary);

    const first = ensureGooglePlacesReady();
    const second = ensureGooglePlacesReady();

    expect(second).toBe(first);
    expect(importLibrary).toHaveBeenCalledTimes(1);
    expect(importLibrary).toHaveBeenCalledWith("places");

    const places = createPlacesRuntime();
    (window as any).google.maps.places = places;
    resolveImport();

    await expect(first).resolves.toBe(places);
  });

  it("waits for the namespace after import resolution and clears readiness timers", async () => {
    const importLibrary = jest.fn().mockResolvedValue(undefined);
    installMapsRuntime(importLibrary);

    const readiness = ensureGooglePlacesReady();
    await Promise.resolve();
    expect(jest.getTimerCount()).toBe(2);

    const places = createPlacesRuntime();
    (window as any).google.maps.places = places;
    jest.advanceTimersByTime(50);

    await expect(readiness).resolves.toBe(places);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("returns a safe typed timeout without provider payloads", async () => {
    installMapsRuntime(jest.fn().mockResolvedValue(undefined));

    const readiness = ensureGooglePlacesReady();
    await Promise.resolve();
    jest.advanceTimersByTime(GOOGLE_PLACES_READINESS_TIMEOUT_MS);

    await expect(readiness).rejects.toEqual(
      expect.objectContaining({
        code: "INTEGRATION_TIMEOUT",
        integration: "google-places",
        message: "Google Places runtime is unavailable.",
      }),
    );
    await expect(readiness).rejects.toBeInstanceOf(IntegrationError);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("times out a stalled import and allows the next caller to retry", async () => {
    const places = createPlacesRuntime();
    const importLibrary = jest
      .fn()
      .mockImplementationOnce(() => new Promise<void>(() => {}))
      .mockImplementationOnce(() => {
        (window as any).google.maps.places = places;
        return Promise.resolve(undefined);
      });
    installMapsRuntime(importLibrary);

    const stalledReadiness = ensureGooglePlacesReady();
    jest.advanceTimersByTime(GOOGLE_PLACES_READINESS_TIMEOUT_MS);

    await expect(stalledReadiness).rejects.toMatchObject({
      code: "INTEGRATION_TIMEOUT",
      integration: "google-places",
    });
    expect(jest.getTimerCount()).toBe(0);

    await expect(ensureGooglePlacesReady()).resolves.toBe(places);
    expect(importLibrary).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("normalizes import rejection to a retryable integration error", async () => {
    installMapsRuntime(jest.fn().mockRejectedValue({ apiKey: "secret" }));

    await expect(ensureGooglePlacesReady()).rejects.toMatchObject({
      code: "INTEGRATION_LOAD_FAILED",
      integration: "google-places",
      retryable: true,
    });
  });
});
