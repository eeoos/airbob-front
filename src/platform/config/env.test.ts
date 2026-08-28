import {
  ConfigError,
  CRA_ENV_KEYS,
  readCraEnvironment,
} from "./env";

describe("readCraEnvironment", () => {
  it("reads only the explicit CRA browser-public allowlist", () => {
    const environment = readCraEnvironment({
      NODE_ENV: "production",
      REACT_APP_API_URL: "https://api.airbob.test",
      REACT_APP_GOOGLE_MAPS_API_KEY: "maps-public-key",
      REACT_APP_TOSS_CLIENT_KEY: "toss-public-key",
      REACT_APP_CLOUDFRONT_DOMAIN: "assets.airbob.test",
      REACT_APP_QA_PASSWORD: "qa-password-canary",
      REACT_APP_TOSS_SECRET_KEY: "toss-secret-canary",
      REACT_APP_COOKIE: "cookie-canary",
      REACT_APP_TOKEN: "token-canary",
    });

    expect(environment).toEqual({
      mode: "production",
      apiUrl: "https://api.airbob.test",
      googleMapsApiKey: "maps-public-key",
      tossClientKey: "toss-public-key",
      cloudFrontDomain: "assets.airbob.test",
    });
    expect(JSON.stringify(environment)).not.toMatch(
      /qa-password-canary|toss-secret-canary|cookie-canary|token-canary/,
    );
  });

  it.each([undefined, "preview", "PRODUCTION"])(
    "rejects unsupported runtime mode %p without exposing its value",
    (mode) => {
      let thrownError: unknown;

      try {
        readCraEnvironment({ NODE_ENV: mode });
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ConfigError);
      expect(thrownError).toMatchObject({
        kind: mode === undefined ? "missing" : "invalid",
        key: CRA_ENV_KEYS.mode,
      });
      expect((thrownError as Error).message).not.toContain(String(mode));
    },
  );
});
