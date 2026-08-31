import path from "node:path";
import { loadEnv } from "vite";

export const PUBLIC_RUNTIME_ENV_KEYS = Object.freeze([
  "REACT_APP_API_URL",
  "REACT_APP_GOOGLE_MAPS_API_KEY",
  "REACT_APP_TOSS_CLIENT_KEY",
  "REACT_APP_CLOUDFRONT_DOMAIN",
]);
export const PUBLIC_BUILD_ENV_KEYS = Object.freeze([
  "PUBLIC_URL",
  ...PUBLIC_RUNTIME_ENV_KEYS,
]);
const TOSS_CLIENT_KEY_PATTERN = /^(?:test|live)_ck_[A-Za-z0-9_-]{1,256}$/;
const GOOGLE_MAPS_BROWSER_KEY_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const KNOWN_SERVER_SECRET_PATTERN =
  /(?:^|[^A-Za-z0-9])(?:test|live)_sk_[A-Za-z0-9_-]{1,256}(?:$|[^A-Za-z0-9_-])/i;
const SAFE_PUBLIC_ASSET_BASE_PATTERN = /^[A-Za-z0-9._~:/-]+$/;
const DEFAULT_CLOUDFRONT_DOMAIN = "d1wivnghydqg7i.cloudfront.net";

const invalidBuildConfiguration = (category) =>
  new Error(`Production build ${category} configuration is invalid.`);

const trimOptional = (value) => (typeof value === "string" ? value.trim() : "");

const rejectKnownServerSecret = (value, category) => {
  const candidate = trimOptional(value);

  if (candidate && KNOWN_SERVER_SECRET_PATTERN.test(candidate)) {
    throw invalidBuildConfiguration(category);
  }
};

const rejectAmbiguousEncoding = (value, category) => {
  const candidate = typeof value === "string" ? value : "";
  const hasAsciiControl = Array.from(candidate).some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 31 || codePoint === 127;
  });

  if (candidate.includes("%") || hasAsciiControl) {
    throw invalidBuildConfiguration(category);
  }
};

const validateApiOrigin = (value) => {
  const candidate = trimOptional(value);
  if (!candidate) throw invalidBuildConfiguration("API origin");

  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !url.hostname
    ) {
      throw invalidBuildConfiguration("API origin");
    }
    if (KNOWN_SERVER_SECRET_PATTERN.test(url.hostname)) {
      throw invalidBuildConfiguration("API origin");
    }
  } catch {
    throw invalidBuildConfiguration("API origin");
  }
};

const validateTossClientKey = (value) => {
  const candidate = trimOptional(value);
  if (!candidate) return;

  if (!TOSS_CLIENT_KEY_PATTERN.test(candidate)) {
    throw invalidBuildConfiguration("Toss browser client-key");
  }
};

const validateGoogleMapsBrowserKey = (value) => {
  const candidate = trimOptional(value);
  if (!candidate) return;

  if (!GOOGLE_MAPS_BROWSER_KEY_PATTERN.test(candidate)) {
    throw invalidBuildConfiguration("Google Maps browser key");
  }
};

const validateCloudFrontDomain = (value) => {
  const candidate = trimOptional(value) || DEFAULT_CLOUDFRONT_DOMAIN;
  const urlCandidate = candidate.includes("://")
    ? candidate
    : `https://${candidate}`;

  try {
    const url = new URL(urlCandidate);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.port ||
      !url.hostname
    ) {
      throw invalidBuildConfiguration("CloudFront domain");
    }
    if (KNOWN_SERVER_SECRET_PATTERN.test(url.hostname)) {
      throw invalidBuildConfiguration("CloudFront domain");
    }
  } catch {
    throw invalidBuildConfiguration("CloudFront domain");
  }
};

const validatePublicAssetBase = (value) => {
  if (value === undefined || value === "") return;
  if (typeof value !== "string" || value !== value.trim()) {
    throw invalidBuildConfiguration("public asset-base");
  }

  if (!SAFE_PUBLIC_ASSET_BASE_PATTERN.test(value)) {
    throw invalidBuildConfiguration("public asset-base");
  }

  if (value.startsWith("/")) {
    if (value.startsWith("//")) {
      throw invalidBuildConfiguration("public asset-base");
    }

    try {
      const url = new URL(value, "https://public-asset-base.invalid");
      if (
        url.origin !== "https://public-asset-base.invalid" ||
        url.search ||
        url.hash
      ) {
        throw invalidBuildConfiguration("public asset-base");
      }
      return;
    } catch {
      throw invalidBuildConfiguration("public asset-base");
    }
  }

  if (!/^https:\/\/[^/]/i.test(value)) {
    throw invalidBuildConfiguration("public asset-base");
  }

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.hostname
    ) {
      throw invalidBuildConfiguration("public asset-base");
    }
  } catch {
    throw invalidBuildConfiguration("public asset-base");
  }
};

export const validatePublicBuildEnvironment = (environment) => {
  rejectAmbiguousEncoding(environment.PUBLIC_URL, "public asset-base");
  rejectAmbiguousEncoding(environment.REACT_APP_API_URL, "API origin");
  rejectAmbiguousEncoding(
    environment.REACT_APP_GOOGLE_MAPS_API_KEY,
    "Google Maps browser key",
  );
  rejectAmbiguousEncoding(
    environment.REACT_APP_TOSS_CLIENT_KEY,
    "Toss browser client-key",
  );
  rejectAmbiguousEncoding(
    environment.REACT_APP_CLOUDFRONT_DOMAIN,
    "CloudFront domain",
  );
  rejectKnownServerSecret(environment.PUBLIC_URL, "public asset-base");
  rejectKnownServerSecret(environment.REACT_APP_API_URL, "API origin");
  rejectKnownServerSecret(
    environment.REACT_APP_GOOGLE_MAPS_API_KEY,
    "Google Maps browser key",
  );
  rejectKnownServerSecret(
    environment.REACT_APP_TOSS_CLIENT_KEY,
    "Toss browser client-key",
  );
  rejectKnownServerSecret(
    environment.REACT_APP_CLOUDFRONT_DOMAIN,
    "CloudFront domain",
  );

  validateApiOrigin(environment.REACT_APP_API_URL);
  validateGoogleMapsBrowserKey(environment.REACT_APP_GOOGLE_MAPS_API_KEY);
  validateTossClientKey(environment.REACT_APP_TOSS_CLIENT_KEY);
  validateCloudFrontDomain(environment.REACT_APP_CLOUDFRONT_DOMAIN);
  validatePublicAssetBase(environment.PUBLIC_URL);
};

export const loadPublicBuildEnvironment = ({
  mode = "production",
  root = process.cwd(),
} = {}) => {
  const loadedEnvironment = loadEnv(mode, root, ["PUBLIC_URL", "REACT_APP_"]);

  return Object.freeze(
    Object.fromEntries(
      PUBLIC_BUILD_ENV_KEYS.map((key) => [
        key,
        Object.prototype.hasOwnProperty.call(process.env, key)
          ? process.env[key]
          : loadedEnvironment[key],
      ]),
    ),
  );
};

if (path.basename(process.argv[1] ?? "") === "validate-public-build-env.mjs") {
  try {
    const environment = loadPublicBuildEnvironment();
    validatePublicBuildEnvironment(environment);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Public build environment is invalid."}\n`,
    );
    process.exitCode = 1;
  }
}
