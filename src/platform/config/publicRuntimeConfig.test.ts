import { ConfigError } from "./env";
import {
  createPublicRuntimeConfig,
  serializePublicRuntimeConfig,
  toSerializablePublicRuntimeConfig,
} from "./publicRuntimeConfig";

describe("public runtime configuration", () => {
  it("uses the development proxy API path regardless of the configured origin", () => {
    const config = createPublicRuntimeConfig({
      mode: "development",
      apiUrl: "https://api.airbob.test/",
    });

    expect(config.apiBaseUrl).toBe("/api/v1");
  });

  it.each([
    ["https://api.airbob.test", "https://api.airbob.test/api/v1"],
    ["https://api.airbob.test/", "https://api.airbob.test/api/v1"],
  ])("normalizes the production API origin %s", (apiUrl, expected) => {
    const config = createPublicRuntimeConfig({
      mode: "production",
      apiUrl,
    });

    expect(config.apiBaseUrl).toBe(expected);
  });

  it("uses the localhost fallback only in test mode", () => {
    expect(createPublicRuntimeConfig({ mode: "test" }).apiBaseUrl).toBe(
      "http://localhost:8080/api/v1",
    );
    expect(
      createPublicRuntimeConfig({
        mode: "test",
        apiUrl: "http://localhost:9090/",
      }).apiBaseUrl,
    ).toBe("http://localhost:9090/api/v1");
  });

  it.each([undefined, "", "   "])(
    "fails closed when the production API origin is missing (%p)",
    (apiUrl) => {
      let thrownError: unknown;

      try {
        createPublicRuntimeConfig({
          mode: "production",
          ...(apiUrl === undefined ? {} : { apiUrl }),
        });
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ConfigError);
      expect(thrownError).toMatchObject({
        kind: "missing",
        key: "REACT_APP_API_URL",
      });
      expect((thrownError as Error).message).toBe(
        "Public runtime configuration REACT_APP_API_URL is missing.",
      );
    },
  );

  it.each([
    [
      "apiUrl",
      "REACT_APP_API_URL",
      "https://%74est%5fsk%5fprivate.example.invalid",
    ],
    [
      "googleMapsApiKey",
      "REACT_APP_GOOGLE_MAPS_API_KEY",
      "%74est%5fsk%5fprivate",
    ],
    [
      "cloudFrontDomain",
      "REACT_APP_CLOUDFRONT_DOMAIN",
      "%74est%5fsk%5fprivate.example.invalid",
    ],
    [
      "apiUrl",
      "REACT_APP_API_URL",
      "https://te\nst_sk_private.example.invalid",
    ],
    [
      "cloudFrontDomain",
      "REACT_APP_CLOUDFRONT_DOMAIN",
      "te\tst_sk_private.example.invalid",
    ],
  ] as const)(
    "rejects ambiguous encoded public input in %s without exposing it",
    (field, key, encodedValue) => {
      const environment = {
        mode: "production" as const,
        apiUrl: "https://api.airbob.test",
        googleMapsApiKey: "maps-public-key",
        tossClientKey: "test_ck_toss_public_key",
        cloudFrontDomain: "assets.airbob.test",
        [field]: encodedValue,
      };
      let thrownError: unknown;

      try {
        createPublicRuntimeConfig(environment);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toMatchObject({ kind: "invalid", key });
      expect((thrownError as Error).message).not.toContain(encodedValue);
      expect(JSON.stringify(thrownError)).not.toContain(encodedValue);
    },
  );

  it("keeps optional integration keys empty without failing application boot", () => {
    const config = createPublicRuntimeConfig({ mode: "test" });

    expect(config).toMatchObject({
      apiBaseUrl: "http://localhost:8080/api/v1",
      googleMapsBrowserKey: null,
      tossClientKey: null,
      cloudFrontHost: "d1wivnghydqg7i.cloudfront.net",
    });
  });

  it.each([
    "http://api.airbob.test",
    "http://localhost:8080",
    "ftp://api.airbob.test",
    "https://user:password@api.airbob.test",
    "https://api.airbob.test/path",
    "https://api.airbob.test?token=secret-canary",
    "https://api.airbob.test#secret-canary",
  ])("rejects an invalid API origin without exposing its value", (apiUrl) => {
    let thrownError: unknown;

    try {
      createPublicRuntimeConfig({ mode: "production", apiUrl });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ConfigError);
    expect(thrownError).toMatchObject({
      kind: "invalid",
      key: "REACT_APP_API_URL",
    });
    expect((thrownError as Error).message).not.toContain(apiUrl);
  });

  it.each([
    "http://assets.airbob.test",
    "https://assets.airbob.test/path",
    "https://user:password@assets.airbob.test",
    "assets.airbob.test:8443",
    "https://assets.airbob.test:8443",
  ])(
    "rejects an invalid asset domain without exposing its value",
    (cloudFrontDomain) => {
      let thrownError: unknown;

      try {
        createPublicRuntimeConfig({
          mode: "production",
          apiUrl: "https://api.airbob.test",
          cloudFrontDomain,
        });
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ConfigError);
      expect(thrownError).toMatchObject({
        kind: "invalid",
        key: "REACT_APP_CLOUDFRONT_DOMAIN",
      });
      expect((thrownError as Error).message).not.toContain(cloudFrontDomain);
    },
  );

  it("normalizes the explicit default HTTPS asset port", () => {
    const config = createPublicRuntimeConfig({
      mode: "production",
      apiUrl: "https://api.airbob.test",
      cloudFrontDomain: "https://assets.airbob.test:443",
    });

    expect(config.cloudFrontHost).toBe("assets.airbob.test");
  });

  it.each(["toss-public-key", "test_ck_contains.invalid-character"])(
    "rejects a non-client Toss key category without exposing it",
    (tossClientKey) => {
      let thrownError: unknown;

      try {
        createPublicRuntimeConfig({
          mode: "production",
          apiUrl: "https://api.airbob.test",
          tossClientKey,
        });
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ConfigError);
      expect(thrownError).toMatchObject({
        kind: "invalid",
        key: "REACT_APP_TOSS_CLIENT_KEY",
      });
      expect((thrownError as Error).message).not.toContain(tossClientKey);
    },
  );

  it.each(["maps key", "maps.key", "<script>maps-key</script>"])(
    "rejects an invalid Google Maps browser key without exposing it",
    (googleMapsApiKey) => {
      expect(() =>
        createPublicRuntimeConfig({
          mode: "production",
          apiUrl: "https://api.airbob.test",
          googleMapsApiKey,
        }),
      ).toThrow(
        expect.objectContaining({
          kind: "invalid",
          key: "REACT_APP_GOOGLE_MAPS_API_KEY",
        }),
      );
    },
  );

  it.each([
    ["apiUrl", "REACT_APP_API_URL", "test"],
    ["apiUrl", "REACT_APP_API_URL", "live"],
    ["googleMapsApiKey", "REACT_APP_GOOGLE_MAPS_API_KEY", "test"],
    ["googleMapsApiKey", "REACT_APP_GOOGLE_MAPS_API_KEY", "live"],
    ["tossClientKey", "REACT_APP_TOSS_CLIENT_KEY", "test"],
    ["tossClientKey", "REACT_APP_TOSS_CLIENT_KEY", "live"],
    ["cloudFrontDomain", "REACT_APP_CLOUDFRONT_DOMAIN", "test"],
    ["cloudFrontDomain", "REACT_APP_CLOUDFRONT_DOMAIN", "live"],
  ] as const)(
    "rejects a misplaced %s %s server secret without exposing it",
    (field, key, environmentPrefix) => {
      const secret = `${environmentPrefix}_sk_misplaced_server_secret_canary`;
      const misplacedSecret =
        field === "apiUrl"
          ? `https://${secret}.example.invalid`
          : field === "cloudFrontDomain"
            ? `${secret}.example.invalid`
            : secret;
      const environment = {
        mode: "production" as const,
        apiUrl: "https://api.airbob.test",
        googleMapsApiKey: "maps-public-key",
        tossClientKey: "test_ck_toss_public_key",
        cloudFrontDomain: "assets.airbob.test",
        [field]: misplacedSecret,
      };
      let thrownError: unknown;

      try {
        createPublicRuntimeConfig(environment);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ConfigError);
      expect(thrownError).toMatchObject({
        kind: "invalid",
        key,
      });
      expect((thrownError as Error).message).not.toContain(misplacedSecret);
      expect(JSON.stringify(thrownError)).not.toContain(misplacedSecret);
    },
  );

  it("serializes only the four browser-public configuration values", () => {
    const config = createPublicRuntimeConfig({
      mode: "production",
      apiUrl: "https://api.airbob.test",
      googleMapsApiKey: "maps-public-key",
      tossClientKey: "test_ck_toss_public_key",
      cloudFrontDomain: "assets.airbob.test",
    });
    const serializedConfig = serializePublicRuntimeConfig(config);

    expect(Object.keys(toSerializablePublicRuntimeConfig(config))).toEqual([
      "apiBaseUrl",
      "googleMapsBrowserKey",
      "tossClientKey",
      "cloudFrontHost",
    ]);
    expect(serializedConfig).toBe(
      JSON.stringify({
        apiBaseUrl: "https://api.airbob.test/api/v1",
        googleMapsBrowserKey: "maps-public-key",
        tossClientKey: "test_ck_toss_public_key",
        cloudFrontHost: "assets.airbob.test",
      }),
    );
    expect(serializedConfig).not.toContain("mode");
  });

  it("escapes script-breaking characters in serialized public values", () => {
    const config = {
      mode: "production" as const,
      apiBaseUrl: "https://api.airbob.test/api/v1",
      googleMapsBrowserKey:
        "</script><script>alert(1)</script>line\u2028separator\u2029canary",
      tossClientKey: "test_ck_serialization_canary",
      cloudFrontHost: "d1wivnghydqg7i.cloudfront.net",
    };
    const serializedConfig = serializePublicRuntimeConfig(config);

    expect(serializedConfig).not.toContain("<");
    expect(serializedConfig).not.toContain("\u2028");
    expect(serializedConfig).not.toContain("\u2029");
    expect(serializedConfig).toContain("\\u003c/script>");
    expect(serializedConfig).toContain("line\\u2028separator\\u2029canary");
  });
});
