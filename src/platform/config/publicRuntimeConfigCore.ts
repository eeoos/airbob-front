import {
  ConfigError,
  PUBLIC_ENV_KEYS,
  type BrowserEnvironment,
  type RuntimeMode,
} from "./env";

const DEFAULT_API_ORIGIN = "http://localhost:8080";
const DEFAULT_CLOUDFRONT_DOMAIN = "d1wivnghydqg7i.cloudfront.net";
const GOOGLE_MAPS_BROWSER_KEY_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const KNOWN_SERVER_SECRET_PATTERN =
  /(?:^|[^A-Za-z0-9])(?:test|live)_sk_[A-Za-z0-9_-]{1,256}(?:$|[^A-Za-z0-9_-])/i;

export interface PublicRuntimeConfig {
  readonly mode: RuntimeMode;
  readonly apiBaseUrl: string;
  readonly googleMapsBrowserKey: string | null;
  readonly tossClientKey: string | null;
  readonly cloudFrontHost: string;
}

const trimOptional = (value: string | undefined): string => value?.trim() ?? "";

const trimNullable = (value: string | undefined): string | null =>
  trimOptional(value) || null;

const rejectKnownServerSecret = (
  value: string | undefined,
  key: string,
): void => {
  const candidate = trimOptional(value);

  if (candidate && KNOWN_SERVER_SECRET_PATTERN.test(candidate)) {
    throw new ConfigError("invalid", key);
  }
};

const rejectAmbiguousEncoding = (
  value: string | undefined,
  key: string,
): void => {
  const candidate = value ?? "";
  const hasAsciiControl = Array.from(candidate).some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 31 || codePoint === 127;
  });

  if (candidate.includes("%") || hasAsciiControl) {
    throw new ConfigError("invalid", key);
  }
};

const parseTossClientKey = (value: string | undefined): string | null => {
  const candidate = trimNullable(value);
  if (!candidate) return null;

  if (!/^(?:test|live)_ck_[A-Za-z0-9_-]{1,256}$/.test(candidate)) {
    throw new ConfigError("invalid", PUBLIC_ENV_KEYS.tossClientKey);
  }

  return candidate;
};

const parseGoogleMapsBrowserKey = (
  value: string | undefined,
): string | null => {
  const candidate = trimNullable(value);
  if (!candidate) return null;

  if (!GOOGLE_MAPS_BROWSER_KEY_PATTERN.test(candidate)) {
    throw new ConfigError("invalid", PUBLIC_ENV_KEYS.googleMapsApiKey);
  }

  return candidate;
};

const parseApiOrigin = (
  value: string | undefined,
  mode: Exclude<RuntimeMode, "development">,
): string => {
  const configuredOrigin = trimOptional(value);

  if (!configuredOrigin && mode === "production") {
    throw new ConfigError("missing", PUBLIC_ENV_KEYS.apiUrl);
  }

  const candidate = configuredOrigin || DEFAULT_API_ORIGIN;

  try {
    const url = new URL(candidate);
    const hasUnsupportedProtocol =
      mode === "production"
        ? url.protocol !== "https:"
        : url.protocol !== "http:" && url.protocol !== "https:";
    const hasCredentials = Boolean(url.username || url.password);
    const hasQueryOrHash = Boolean(url.search || url.hash);
    const hasNonRootPath = url.pathname !== "/";

    if (
      hasUnsupportedProtocol ||
      hasCredentials ||
      hasQueryOrHash ||
      hasNonRootPath ||
      !url.hostname
    ) {
      throw new Error("unsupported API origin");
    }
    if (KNOWN_SERVER_SECRET_PATTERN.test(url.hostname)) {
      throw new Error("server secret used as API origin");
    }

    return url.origin;
  } catch {
    throw new ConfigError("invalid", PUBLIC_ENV_KEYS.apiUrl);
  }
};

const parseCloudFrontDomain = (value: string | undefined): string => {
  const candidate = trimOptional(value) || DEFAULT_CLOUDFRONT_DOMAIN;
  const urlCandidate = candidate.includes("://")
    ? candidate
    : `https://${candidate}`;

  try {
    const url = new URL(urlCandidate);
    const hasCredentials = Boolean(url.username || url.password);
    const hasQueryOrHash = Boolean(url.search || url.hash);
    const hasNonRootPath = url.pathname !== "/";
    const hasNonDefaultPort = Boolean(url.port);

    if (
      url.protocol !== "https:" ||
      hasCredentials ||
      hasQueryOrHash ||
      hasNonRootPath ||
      hasNonDefaultPort ||
      !url.hostname
    ) {
      throw new Error("unsupported asset domain");
    }
    if (KNOWN_SERVER_SECRET_PATTERN.test(url.hostname)) {
      throw new Error("server secret used as asset domain");
    }

    return url.hostname;
  } catch {
    throw new ConfigError("invalid", PUBLIC_ENV_KEYS.cloudFrontDomain);
  }
};

export const createPublicRuntimeConfig = (
  environment: BrowserEnvironment,
): PublicRuntimeConfig => {
  rejectAmbiguousEncoding(environment.apiUrl, PUBLIC_ENV_KEYS.apiUrl);
  rejectAmbiguousEncoding(
    environment.googleMapsApiKey,
    PUBLIC_ENV_KEYS.googleMapsApiKey,
  );
  rejectAmbiguousEncoding(
    environment.tossClientKey,
    PUBLIC_ENV_KEYS.tossClientKey,
  );
  rejectAmbiguousEncoding(
    environment.cloudFrontDomain,
    PUBLIC_ENV_KEYS.cloudFrontDomain,
  );
  rejectKnownServerSecret(environment.apiUrl, PUBLIC_ENV_KEYS.apiUrl);
  rejectKnownServerSecret(
    environment.googleMapsApiKey,
    PUBLIC_ENV_KEYS.googleMapsApiKey,
  );
  rejectKnownServerSecret(
    environment.tossClientKey,
    PUBLIC_ENV_KEYS.tossClientKey,
  );
  rejectKnownServerSecret(
    environment.cloudFrontDomain,
    PUBLIC_ENV_KEYS.cloudFrontDomain,
  );

  return Object.freeze({
    mode: environment.mode,
    apiBaseUrl:
      environment.mode === "development"
        ? "/api/v1"
        : `${parseApiOrigin(environment.apiUrl, environment.mode)}/api/v1`,
    googleMapsBrowserKey: parseGoogleMapsBrowserKey(
      environment.googleMapsApiKey,
    ),
    tossClientKey: parseTossClientKey(environment.tossClientKey),
    cloudFrontHost: parseCloudFrontDomain(environment.cloudFrontDomain),
  });
};
