import { getPublicRuntimeConfig } from "../config/publicRuntimeConfig";

const getValidatedAssetOrigin = (cloudFrontHost: string) => {
  const normalizedHost = cloudFrontHost.trim().replace(/\.$/, "");

  try {
    const url = new URL(`https://${normalizedHost}`);
    if (
      !normalizedHost ||
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }

    return url.origin;
  } catch {
    throw new Error("Public image host configuration is invalid.");
  }
};

const parseAbsoluteHttpUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

/**
 * Resolves API image paths at the public asset boundary.
 *
 * Legacy absolute HTTP image values are upgraded to HTTPS. Returning the HTTP
 * value would create mixed-content requests on the HTTPS application; dropping
 * the image entirely would be a larger compatibility break than upgrading it.
 */
export const resolveImageUrl = (
  imagePath: string | null | undefined,
  cloudFrontHost = getPublicRuntimeConfig().cloudFrontHost,
): string => {
  const value = imagePath?.trim();
  if (!value) return "";

  const assetOrigin = getValidatedAssetOrigin(cloudFrontHost);
  const absoluteUrl = parseAbsoluteHttpUrl(value);

  if (absoluteUrl) {
    if (absoluteUrl.username || absoluteUrl.password) return "";
    absoluteUrl.protocol = "https:";
    return absoluteUrl.toString();
  }

  const configuredHostname = new URL(assetOrigin).hostname;
  if (
    value === configuredHostname ||
    value.startsWith(`${configuredHostname}/`)
  ) {
    return `https://${value}`;
  }

  const relativePath = value.replace(/^\/+/, "");
  return `${assetOrigin}/${relativePath}`;
};
