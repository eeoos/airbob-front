import { ConfigError, PUBLIC_ENV_KEYS, readBrowserEnvironment } from "./env";
import {
  createPublicRuntimeConfig,
  type PublicRuntimeConfig,
} from "./publicRuntimeConfigCore";

export type { PublicRuntimeConfig } from "./publicRuntimeConfigCore";

export const getPublicRuntimeConfig = (): PublicRuntimeConfig =>
  createPublicRuntimeConfig(readBrowserEnvironment());

export const getApiBaseUrl = (): string => getPublicRuntimeConfig().apiBaseUrl;

export const requireTossClientKey = (): string => {
  const key = getPublicRuntimeConfig().tossClientKey;
  if (!key) {
    throw new ConfigError("missing", PUBLIC_ENV_KEYS.tossClientKey);
  }

  return key;
};
