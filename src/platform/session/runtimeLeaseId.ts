declare const sessionRuntimeLeaseIdBrand: unique symbol;

/**
 * Per-controller runtime authority. It is intentionally absent from reducer
 * state and query identity because a fresh document must never inherit a
 * previous document's recovery lease merely by reproducing its epoch.
 */
export type SessionRuntimeLeaseId = string & {
  readonly [sessionRuntimeLeaseIdBrand]: "SessionRuntimeLeaseId";
};

export type SessionRuntimeLeaseIdFactory = () => SessionRuntimeLeaseId;

const toHex = (value: number) => value.toString(16).padStart(2, "0");

const formatUuidV4 = (bytes: Uint8Array): SessionRuntimeLeaseId => {
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, toHex).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-") as SessionRuntimeLeaseId;
};

export const createSessionRuntimeLeaseId: SessionRuntimeLeaseIdFactory = () => {
  const cryptoSource = globalThis.crypto;
  if (typeof cryptoSource?.randomUUID === "function") {
    return cryptoSource.randomUUID() as SessionRuntimeLeaseId;
  }
  if (typeof cryptoSource?.getRandomValues !== "function") {
    throw new Error("Secure session runtime lease generation is unavailable.");
  }

  return formatUuidV4(cryptoSource.getRandomValues(new Uint8Array(16)));
};
