import {
  sessionStorageDriver,
  type SessionStorageDriver,
  type StorageAccessError,
} from "./sessionStorageDriver";

export type BrowserDataPrivacyClass =
  "public" | "internal" | "personal" | "sensitive";

export interface VersionedStorageEnvelope<T> {
  purpose: string;
  version: number;
  privacyClass: BrowserDataPrivacyClass;
  containsPii: boolean;
  owner: string;
  createdAt: number;
  expiresAt: number;
  data: T;
}

export type VersionedStorageRejectionReason =
  | "malformed"
  | "unknown-fields"
  | "wrong-purpose"
  | "wrong-version"
  | "wrong-privacy-class"
  | "wrong-pii-classification"
  | "foreign-owner"
  | "invalid-lifetime"
  | "expired"
  | "invalid-data";

export type StorageCleanupStatus = "purged" | "storage-error";

export type VersionedStorageReadResult<T> =
  | { status: "found"; record: VersionedStorageEnvelope<T> }
  | { status: "missing" }
  | { status: "invalid-owner" }
  | { status: "clock-error" }
  | {
      status: "rejected";
      reason: VersionedStorageRejectionReason;
      cleanup: StorageCleanupStatus;
    }
  | { status: "storage-error"; error: StorageAccessError };

export type VersionedStorageWriteResult =
  | { status: "written" }
  | { status: "stale" }
  | { status: "invalid-owner" }
  | { status: "invalid-data" }
  | { status: "invalid-clock" }
  | { status: "serialization-error" }
  | { status: "storage-error"; error: StorageAccessError };

export type VersionedStorageClearResult =
  | { status: "cleared" }
  | { status: "storage-error"; error: StorageAccessError };

export type VersionedStorageNamespaceClearResult =
  | { status: "cleared"; removed: number }
  | { status: "partial"; removed: number; failed: number }
  | { status: "storage-error"; error: StorageAccessError };

export interface CreateVersionedSessionStorageOptions<T extends object> {
  namespace: string;
  slot: string;
  purpose: string;
  version: number;
  privacyClass: BrowserDataPrivacyClass;
  containsPii: boolean;
  ttlMs: number;
  dataKeys: readonly Extract<keyof T, string>[];
  validateData: (value: unknown) => value is T;
  driver?: SessionStorageDriver;
  now?: () => number;
}

export interface VersionedStorageWriteOptions<T> {
  owner: string;
  data: T;
  isCurrent?: () => boolean;
}

export interface VersionedSessionStorage<T extends object> {
  readonly storageKey: string;
  read(owner: string): VersionedStorageReadResult<T>;
  write(options: VersionedStorageWriteOptions<T>): VersionedStorageWriteResult;
  clear(): VersionedStorageClearResult;
  clearNamespace(): VersionedStorageNamespaceClearResult;
}

const envelopeKeys = [
  "purpose",
  "version",
  "privacyClass",
  "containsPii",
  "owner",
  "createdAt",
  "expiresAt",
  "data",
] as const;

const safeNamespacePattern = /^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)+$/;
const safeSlotPattern = /^[a-z][a-z0-9-]*$/;
const safeDataKeyPattern = /^[A-Za-z][A-Za-z0-9_]*$/;
const stableOwnerPattern = /^subject:[A-Za-z0-9_-]{3,128}$/;
const dangerousDataKeys = new Set(["constructor", "prototype", "__proto__"]);
const privacyClasses = new Set<BrowserDataPrivacyClass>([
  "public",
  "internal",
  "personal",
  "sensitive",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
) => {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...allowedKeys].sort();

  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  );
};

interface StaticStorageConfiguration {
  namespace: string;
  slot: string;
  purpose: string;
  version: number;
  ttlMs: number;
  dataKeys: readonly string[];
  privacyClass: unknown;
  containsPii: unknown;
}

const assertStaticStorageConfiguration = ({
  namespace,
  slot,
  purpose,
  version,
  ttlMs,
  dataKeys,
  privacyClass,
  containsPii,
}: StaticStorageConfiguration) => {
  if (!safeNamespacePattern.test(namespace)) {
    throw new TypeError(
      "Versioned browser storage requires a static, namespaced public key.",
    );
  }
  if (!safeSlotPattern.test(slot)) {
    throw new TypeError(
      "Versioned browser storage slots must be static slugs, never runtime identifiers.",
    );
  }
  if (!safeSlotPattern.test(purpose)) {
    throw new TypeError(
      "Versioned browser storage purpose must be a static slug.",
    );
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new TypeError(
      "Versioned browser storage version must be a positive integer.",
    );
  }
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) {
    throw new TypeError(
      "Versioned browser storage TTL must be a positive integer.",
    );
  }
  if (!privacyClasses.has(privacyClass as BrowserDataPrivacyClass)) {
    throw new TypeError("Versioned browser storage privacy class is invalid.");
  }
  if (typeof containsPii !== "boolean") {
    throw new TypeError(
      "Versioned browser storage PII classification is required.",
    );
  }
  if (
    dataKeys.length === 0 ||
    new Set(dataKeys).size !== dataKeys.length ||
    dataKeys.some(
      (key) =>
        typeof key !== "string" ||
        !safeDataKeyPattern.test(key) ||
        dangerousDataKeys.has(key),
    )
  ) {
    throw new TypeError(
      "Versioned browser storage needs a unique data allowlist.",
    );
  }
};

const isStableOwner = (owner: string) => stableOwnerPattern.test(owner);

export const createVersionedSessionStorage = <T extends object>(
  options: CreateVersionedSessionStorageOptions<T>,
): VersionedSessionStorage<T> => {
  assertStaticStorageConfiguration(options);

  const {
    namespace,
    slot,
    purpose,
    version,
    privacyClass,
    containsPii,
    ttlMs,
    dataKeys,
    validateData,
    driver = sessionStorageDriver,
    now = Date.now,
  } = options;
  const storageKey = `${namespace}:${slot}`;
  const namespacePrefix = `${namespace}:`;

  const currentTime = (): number | null => {
    try {
      const value = now();
      return Number.isSafeInteger(value) && value >= 0 ? value : null;
    } catch {
      return null;
    }
  };

  const remainsCurrent = (guard: () => boolean) => {
    try {
      return guard();
    } catch {
      return false;
    }
  };

  const purgeRejected = (
    reason: VersionedStorageRejectionReason,
  ): VersionedStorageReadResult<T> => {
    const cleanup = driver.removeItem(storageKey);

    return {
      status: "rejected",
      reason,
      cleanup: cleanup.ok ? "purged" : "storage-error",
    };
  };

  const parseCurrentRecord = (
    raw: string,
    owner: string,
  ): VersionedStorageReadResult<T> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return purgeRejected("malformed");
    }

    if (!isRecord(parsed)) return purgeRejected("malformed");
    if (!hasExactKeys(parsed, envelopeKeys)) {
      return purgeRejected("unknown-fields");
    }
    if (parsed.purpose !== purpose) return purgeRejected("wrong-purpose");
    if (parsed.version !== version) return purgeRejected("wrong-version");
    if (parsed.privacyClass !== privacyClass) {
      return purgeRejected("wrong-privacy-class");
    }
    if (parsed.containsPii !== containsPii) {
      return purgeRejected("wrong-pii-classification");
    }
    if (parsed.owner !== owner) return purgeRejected("foreign-owner");
    if (
      !Number.isSafeInteger(parsed.createdAt) ||
      !Number.isSafeInteger(parsed.expiresAt) ||
      (parsed.createdAt as number) < 0 ||
      (parsed.expiresAt as number) - (parsed.createdAt as number) !== ttlMs
    ) {
      return purgeRejected("invalid-lifetime");
    }
    const readAt = currentTime();
    if (readAt === null) return { status: "clock-error" };
    if ((parsed.createdAt as number) > readAt) {
      return purgeRejected("invalid-lifetime");
    }
    if ((parsed.expiresAt as number) <= readAt) return purgeRejected("expired");
    if (!isRecord(parsed.data)) return purgeRejected("invalid-data");
    if (!hasExactKeys(parsed.data, dataKeys)) {
      return purgeRejected("unknown-fields");
    }
    if (!validateData(parsed.data)) return purgeRejected("invalid-data");

    return {
      status: "found",
      record: parsed as unknown as VersionedStorageEnvelope<T>,
    };
  };

  const read = (owner: string): VersionedStorageReadResult<T> => {
    if (!isStableOwner(owner)) return { status: "invalid-owner" };

    const stored = driver.getItem(storageKey);
    if (!stored.ok) return { status: "storage-error", error: stored.error };
    if (stored.value === null) return { status: "missing" };

    return parseCurrentRecord(stored.value, owner);
  };

  const write = ({
    owner,
    data,
    isCurrent = () => true,
  }: VersionedStorageWriteOptions<T>): VersionedStorageWriteResult => {
    if (!isStableOwner(owner)) return { status: "invalid-owner" };
    if (
      !isRecord(data) ||
      !hasExactKeys(data, dataKeys) ||
      !validateData(data)
    ) {
      return { status: "invalid-data" };
    }
    if (!remainsCurrent(isCurrent)) return { status: "stale" };

    const createdAt = currentTime();
    if (createdAt === null || !Number.isSafeInteger(createdAt + ttlMs)) {
      return { status: "invalid-clock" };
    }
    const record: VersionedStorageEnvelope<T> = {
      purpose,
      version,
      privacyClass,
      containsPii,
      owner,
      createdAt,
      expiresAt: createdAt + ttlMs,
      data,
    };
    let serialized: string;
    try {
      serialized = JSON.stringify(record);
    } catch {
      return { status: "serialization-error" };
    }

    try {
      const serializedRecord = JSON.parse(serialized) as { data?: unknown };
      if (
        !isRecord(serializedRecord.data) ||
        !hasExactKeys(serializedRecord.data, dataKeys) ||
        !validateData(serializedRecord.data)
      ) {
        return { status: "serialization-error" };
      }
    } catch {
      return { status: "serialization-error" };
    }

    if (!remainsCurrent(isCurrent)) return { status: "stale" };
    const result = driver.setItem(storageKey, serialized);
    if (!result.ok) return { status: "storage-error", error: result.error };

    return { status: "written" };
  };

  const clear = (): VersionedStorageClearResult => {
    const result = driver.removeItem(storageKey);

    return result.ok
      ? { status: "cleared" }
      : { status: "storage-error", error: result.error };
  };

  const clearNamespace = (): VersionedStorageNamespaceClearResult => {
    const keyResult = driver.keys();
    if (!keyResult.ok) {
      return { status: "storage-error", error: keyResult.error };
    }

    const ownedKeys = keyResult.value.filter((key) =>
      key.startsWith(namespacePrefix),
    );
    const results = ownedKeys.map((key) => driver.removeItem(key));
    const removed = results.filter((result) => result.ok).length;
    const failed = results.length - removed;

    return failed === 0
      ? { status: "cleared", removed }
      : { status: "partial", removed, failed };
  };

  return {
    storageKey,
    read,
    write,
    clear,
    clearNamespace,
  };
};
