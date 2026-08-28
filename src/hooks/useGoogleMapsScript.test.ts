import { act, renderHook, waitFor } from "@testing-library/react";
import { getPublicRuntimeConfig } from "../platform/config/publicRuntimeConfig";
import { useGoogleMapsScript } from "./useGoogleMapsScript";

jest.mock("../platform/config/publicRuntimeConfig", () => ({
  getPublicRuntimeConfig: jest.fn(),
}));

const runtimeConfig = (googleMapsBrowserKey: string | null) => ({
  mode: "test" as const,
  apiBaseUrl: "/api/v1",
  googleMapsBrowserKey,
  tossClientKey: null,
  cloudFrontHost: "assets.example.cloudfront.net",
});

const mapsScripts = () =>
  // Script tags have no accessible role; this integration facade owns the tag.
  // eslint-disable-next-line testing-library/no-node-access
  Array.from(document.scripts).filter((script) =>
    script.src.startsWith("https://maps.googleapis.com/maps/api/js?"),
  );

const setGoogleMapsReady = () => {
  (window as any).google = {
    maps: {
      Map: function Map() {},
      places: {},
    },
  };
};

describe("useGoogleMapsScript", () => {
  const originalGoogle = window.google;

  beforeEach(() => {
    jest.useFakeTimers();
    delete (window as any).google;
    jest.mocked(getPublicRuntimeConfig).mockReturnValue(runtimeConfig("test-key"));
    mapsScripts().forEach((script) => script.remove());
  });

  afterEach(() => {
    mapsScripts().forEach((script) => script.dispatchEvent(new Event("error")));
    mapsScripts().forEach((script) => script.remove());
    jest.clearAllTimers();
    jest.useRealTimers();
    (window as any).google = originalGoogle;
  });

  it("shares one platform loader across hook instances", async () => {
    const { result: firstResult } = renderHook(() => useGoogleMapsScript());
    const { result: secondResult } = renderHook(() => useGoogleMapsScript());

    expect(mapsScripts()).toHaveLength(1);
    expect(firstResult.current.status).toBe("loading");
    expect(secondResult.current.status).toBe("loading");

    act(() => {
      setGoogleMapsReady();
      mapsScripts()[0].dispatchEvent(new Event("load"));
    });

    await waitFor(() =>
      expect([
        firstResult.current.status,
        secondResult.current.status,
      ]).toEqual(["loaded", "loaded"]),
    );
  });

  it("preserves missing-key status without appending a script", () => {
    jest.mocked(getPublicRuntimeConfig).mockReturnValue(runtimeConfig(null));

    const { result } = renderHook(() => useGoogleMapsScript());

    expect(result.current).toEqual({ isLoaded: false, status: "missing-key" });
    expect(mapsScripts()).toHaveLength(0);
  });

  it("reports loaded without a script when the runtime already exists", () => {
    setGoogleMapsReady();

    const { result } = renderHook(() => useGoogleMapsScript());

    expect(result.current).toEqual({ isLoaded: true, status: "loaded" });
    expect(mapsScripts()).toHaveLength(0);
  });

  it("preserves error status after a platform loader failure", async () => {
    const { result } = renderHook(() => useGoogleMapsScript());
    const script = mapsScripts()[0];

    act(() => script.dispatchEvent(new Event("error")));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.isLoaded).toBe(false);
    expect(script.isConnected).toBe(false);
  });
});
