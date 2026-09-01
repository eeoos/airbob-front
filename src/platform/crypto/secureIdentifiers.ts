const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toHex = (value: number): string => value.toString(16).padStart(2, "0");

const formatUuidV4 = (bytes: Uint8Array): string => {
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, toHex).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

/** Creates a UUID backed only by the browser's cryptographic random source. */
export const createCryptographicUuid = (): string => {
  const cryptoSource = globalThis.crypto;
  if (typeof cryptoSource?.randomUUID === "function") {
    const uuid = cryptoSource.randomUUID();
    if (UUID_V4_PATTERN.test(uuid)) return uuid;
    throw new Error("The cryptographic UUID source returned an invalid value.");
  }
  if (typeof cryptoSource?.getRandomValues !== "function") {
    throw new Error("Cryptographic random generation is unavailable.");
  }

  return formatUuidV4(cryptoSource.getRandomValues(new Uint8Array(16)));
};

const toBase64Url = (bytes: Uint8Array): string => {
  const binary = String.fromCharCode(...bytes);
  return globalThis
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
};

/** Returns an unpadded base64url SHA-256 digest for an exact UTF-8 string. */
export const sha256Base64Url = async (value: string): Promise<string> => {
  if (typeof value !== "string") {
    throw new TypeError("The fingerprint source must be a string.");
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Cryptographic hashing is unavailable.");
  }

  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return toBase64Url(new Uint8Array(digest));
};
