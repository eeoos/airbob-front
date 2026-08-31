export const PUBLIC_ENV_KEYS = {
  mode: "NODE_ENV",
  apiUrl: "REACT_APP_API_URL",
  googleMapsApiKey: "REACT_APP_GOOGLE_MAPS_API_KEY",
  tossClientKey: "REACT_APP_TOSS_CLIENT_KEY",
  cloudFrontDomain: "REACT_APP_CLOUDFRONT_DOMAIN",
} as const;

export type RuntimeMode = "development" | "test" | "production";

export type BrowserEnvironmentSource = Readonly<
  Record<string, string | undefined>
>;

interface BrowserBuildProcess {
  readonly env: {
    readonly NODE_ENV?: string;
    readonly REACT_APP_API_URL?: string;
    readonly REACT_APP_GOOGLE_MAPS_API_KEY?: string;
    readonly REACT_APP_TOSS_CLIENT_KEY?: string;
    readonly REACT_APP_CLOUDFRONT_DOMAIN?: string;
  };
}

declare const process: BrowserBuildProcess;

export interface BrowserEnvironment {
  readonly mode: RuntimeMode;
  readonly apiUrl?: string;
  readonly googleMapsApiKey?: string;
  readonly tossClientKey?: string;
  readonly cloudFrontDomain?: string;
}

export type ConfigErrorKind = "missing" | "invalid";

export class ConfigError extends Error {
  readonly kind: ConfigErrorKind;
  readonly key: string;

  constructor(kind: ConfigErrorKind, key: string) {
    const description = kind === "missing" ? "is missing" : "is invalid";
    super(`Public runtime configuration ${key} ${description}.`);

    this.name = "ConfigError";
    this.kind = kind;
    this.key = key;

    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

const readProcessEnvironment = (): BrowserEnvironmentSource => ({
  NODE_ENV: process.env.NODE_ENV,
  REACT_APP_API_URL: process.env.REACT_APP_API_URL,
  REACT_APP_GOOGLE_MAPS_API_KEY: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
  REACT_APP_TOSS_CLIENT_KEY: process.env.REACT_APP_TOSS_CLIENT_KEY,
  REACT_APP_CLOUDFRONT_DOMAIN: process.env.REACT_APP_CLOUDFRONT_DOMAIN,
});

const parseRuntimeMode = (value: string | undefined): RuntimeMode => {
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  throw new ConfigError(
    value === undefined ? "missing" : "invalid",
    PUBLIC_ENV_KEYS.mode,
  );
};

/**
 * Reads the compile-time browser environment through an explicit allowlist.
 *
 * Never pass the complete `process.env` object here. Keeping the production
 * source reads explicit prevents unrelated `REACT_APP_*` values from becoming
 * part of the browser configuration contract.
 */
export const readBrowserEnvironment = (
  source: BrowserEnvironmentSource = readProcessEnvironment(),
): BrowserEnvironment => {
  const apiUrl = source.REACT_APP_API_URL;
  const googleMapsApiKey = source.REACT_APP_GOOGLE_MAPS_API_KEY;
  const tossClientKey = source.REACT_APP_TOSS_CLIENT_KEY;
  const cloudFrontDomain = source.REACT_APP_CLOUDFRONT_DOMAIN;

  return {
    mode: parseRuntimeMode(source.NODE_ENV),
    ...(apiUrl === undefined ? {} : { apiUrl }),
    ...(googleMapsApiKey === undefined ? {} : { googleMapsApiKey }),
    ...(tossClientKey === undefined ? {} : { tossClientKey }),
    ...(cloudFrontDomain === undefined ? {} : { cloudFrontDomain }),
  };
};

export const getRuntimeMode = (): RuntimeMode => readBrowserEnvironment().mode;

export const isTestEnvironment = (): boolean => getRuntimeMode() === "test";
