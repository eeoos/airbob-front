import {
  sessionStorageDriver,
  SessionStorageDriver,
  StorageAccessError,
} from "./sessionStorageDriver";

export type BrowserDataPrivacyClass =
  | "public"
  | "internal"
  | "personal"
  | "sensitive";

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

export type LegacyMigrationVerification<T> =
  | {
      verified: true;
      subjectOwner: string;
      serverTupleVerified: true;
      data: T;
    }
  | { verified: false };

export interface LegacyMigrationContext {
  authenticatedOwner: string;
  currentOwner: string;
}

export type LegacyMigrationResult<T> =
  | { status: "migrated"; record: VersionedStorageEnvelope<T> }
  | { status: "target-wins"; record: VersionedStorageEnvelope<T> }
  | {
      status: "legacy-cleanup-failed";
      outcome: "migrated" | "target-wins";
      record: VersionedStorageEnvelope<T>;
      error: StorageAccessError;
    }
  | { status: "missing" }
  | { status: "stale" }
  | { status: "clock-error" }
  | {
      status: "rejected";
      reason:
        | "unauthenticated"
        | "owner-mismatch"
        | "verification-failed"
        | "invalid-data";
      cleanup: StorageCleanupStatus;
    }
  | { status: "storage-error"; error: StorageAccessError }
  | { status: "write-failed"; result: VersionedStorageWriteResult };

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
  legacyKeys?: readonly string[];
  now?: () => number;
  getEpoch?: () => string | number;
}

export interface VersionedStorageWriteOptions<T> {
  owner: string;
  data: T;
  isCurrent?: () => boolean;
}

export interface LegacyMigrationOptions<T> {
  legacyKey: string;
  authenticatedOwner: string | null;
  currentOwner: string;
  verifyAndMap: (
    raw: string,
    context: LegacyMigrationContext
  ) => Promise<LegacyMigrationVerification<T>>;
  isCurrent: (expectedOwner: string) => boolean;
}

export interface VersionedSessionStorage<T extends object> {
  readonly storageKey: string;
  read(owner: string): VersionedStorageReadResult<T>;
  write(options: VersionedStorageWriteOptions<T>): VersionedStorageWriteResult;
  clear(): VersionedStorageClearResult;
  clearNamespace(): VersionedStorageNamespaceClearResult;
  invalidatePendingOperations(): void;
  migrateLegacy(options: LegacyMigrationOptions<T>): Promise<LegacyMigrationResult<T>>;
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
  allowedKeys: readonly string[]
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
  legacyKeys?: readonly string[];
  getEpoch?: unknown;
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
  legacyKeys = [],
  getEpoch,
}: StaticStorageConfiguration) => {
  if (!safeNamespacePattern.test(namespace)) {
    throw new TypeError(
      "Versioned browser storage requires a static, namespaced public key."
    );
  }
  if (!safeSlotPattern.test(slot)) {
    throw new TypeError(
      "Versioned browser storage slots must be static slugs, never runtime identifiers."
    );
  }
  if (!safeSlotPattern.test(purpose)) {
    throw new TypeError("Versioned browser storage purpose must be a static slug.");
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new TypeError("Versioned browser storage version must be a positive integer.");
  }
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) {
    throw new TypeError("Versioned browser storage TTL must be a positive integer.");
  }
  if (!privacyClasses.has(privacyClass as BrowserDataPrivacyClass)) {
    throw new TypeError("Versioned browser storage privacy class is invalid.");
  }
  if (typeof containsPii !== "boolean") {
    throw new TypeError("Versioned browser storage PII classification is required.");
  }
  if (
    dataKeys.length === 0 ||
    new Set(dataKeys).size !== dataKeys.length ||
    dataKeys.some(
      (key) =>
        typeof key !== "string" ||
        !safeDataKeyPattern.test(key) ||
        dangerousDataKeys.has(key)
    )
  ) {
    throw new TypeError("Versioned browser storage needs a unique data allowlist.");
  }
  if (
    !Array.isArray(legacyKeys) ||
    new Set(legacyKeys).size !== legacyKeys.length ||
    legacyKeys.some((key) => typeof key !== "string" || key.length === 0)
  ) {
    throw new TypeError("Legacy storage keys must be an explicit unique allowlist.");
  }
  if (legacyKeys.length > 0 && typeof getEpoch !== "function") {
    throw new TypeError(
      "Legacy migration requires an authenticated session epoch provider."
    );
  }
};

const isStableOwner = (owner: string) => stableOwnerPattern.test(owner);

export const createVersionedSessionStorage = <T extends object>(
  options: CreateVersionedSessionStorageOptions<T>
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
    legacyKeys = [],
    now = Date.now,
    getEpoch,
  } = options;
  const storageKey = `${namespace}:${slot}`;
  const namespacePrefix = `${namespace}:`;
  const allowedLegacyKeys = new Set(legacyKeys);
  let operationRevision = 0;

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

  const captureEpoch = () => {
    try {
      if (!getEpoch) return { ok: false as const };

      const value = getEpoch();
      const isValid =
        (typeof value === "number" &&
          Number.isSafeInteger(value) &&
          value >= 0) ||
        (typeof value === "string" && value.length > 0 && value.length <= 128);

      return isValid
        ? { ok: true as const, value }
        : { ok: false as const };
    } catch {
      return { ok: false as const };
    }
  };

  const purgeRejected = (
    reason: VersionedStorageRejectionReason
  ): VersionedStorageReadResult<T> => {
    const cleanup = driver.removeItem(storageKey);
    if (cleanup.ok) operationRevision += 1;

    return {
      status: "rejected",
      reason,
      cleanup: cleanup.ok ? "purged" : "storage-error",
    };
  };

  const parseCurrentRecord = (
    raw: string,
    owner: string
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
    if (!isRecord(data) || !hasExactKeys(data, dataKeys) || !validateData(data)) {
      return { status: "invalid-data" };
    }
    if (!remainsCurrent(isCurrent)) return { status: "stale" };

    const createdAt = currentTime();
    if (
      createdAt === null ||
      !Number.isSafeInteger(createdAt + ttlMs)
    ) {
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

    operationRevision += 1;
    return { status: "written" };
  };

  const clear = (): VersionedStorageClearResult => {
    operationRevision += 1;
    const result = driver.removeItem(storageKey);

    return result.ok
      ? { status: "cleared" }
      : { status: "storage-error", error: result.error };
  };

  const clearNamespace = (): VersionedStorageNamespaceClearResult => {
    operationRevision += 1;
    const keyResult = driver.keys();
    if (!keyResult.ok) {
      return { status: "storage-error", error: keyResult.error };
    }

    const ownedKeys = keyResult.value.filter((key) =>
      key.startsWith(namespacePrefix)
    );
    const results = ownedKeys.map((key) => driver.removeItem(key));
    const removed = results.filter((result) => result.ok).length;
    const failed = results.length - removed;

    return failed === 0
      ? { status: "cleared", removed }
      : { status: "partial", removed, failed };
  };

  const purgeLegacy = (
    legacyKey: string
  ): StorageCleanupStatus => {
    operationRevision += 1;
    return driver.removeItem(legacyKey).ok ? "purged" : "storage-error";
  };

  const finishLegacyCleanup = (
    outcome: "migrated" | "target-wins",
    record: VersionedStorageEnvelope<T>,
    legacyKey: string,
    isMigrationCurrent: () => boolean
  ): LegacyMigrationResult<T> => {
    if (!isMigrationCurrent()) return { status: "stale" };

    operationRevision += 1;
    const cleanup = driver.removeItem(legacyKey);

    return cleanup.ok
      ? { status: outcome, record }
      : {
          status: "legacy-cleanup-failed",
          outcome,
          record,
          error: cleanup.error,
        };
  };

  const migrateLegacy = async ({
    legacyKey,
    authenticatedOwner,
    currentOwner,
    verifyAndMap,
    isCurrent,
  }: LegacyMigrationOptions<T>): Promise<LegacyMigrationResult<T>> => {
    if (!allowedLegacyKeys.has(legacyKey)) {
      throw new TypeError("Legacy migration key is not explicitly allowlisted.");
    }
    if (typeof isCurrent !== "function") {
      throw new TypeError(
        "Legacy migration requires a current authenticated owner guard."
      );
    }

    const entryEpoch = captureEpoch();
    if (!entryEpoch.ok) return { status: "stale" };
    const capturedEpoch = entryEpoch.value;
    const isMigrationCurrent = () => {
      const latestEpoch = captureEpoch();
      return (
        latestEpoch.ok &&
        latestEpoch.value === capturedEpoch &&
        remainsCurrent(() => isCurrent(currentOwner))
      );
    };
    const checkLegacySnapshot = (
      expectedRevision: number,
      expectedRaw: string
    ): LegacyMigrationResult<T> | null => {
      if (
        operationRevision !== expectedRevision ||
        !isMigrationCurrent()
      ) {
        return { status: "stale" };
      }

      const latestLegacy = driver.getItem(legacyKey);
      if (!latestLegacy.ok) {
        return { status: "storage-error", error: latestLegacy.error };
      }
      if (
        latestLegacy.value !== expectedRaw ||
        operationRevision !== expectedRevision ||
        !isMigrationCurrent()
      ) {
        return { status: "stale" };
      }

      return null;
    };
    const rejectAndPurgeLegacy = (
      reason:
        | "unauthenticated"
        | "owner-mismatch"
        | "verification-failed"
        | "invalid-data",
      expectedSnapshot?: { revision: number; raw: string }
    ): LegacyMigrationResult<T> => {
      if (expectedSnapshot) {
        const snapshotFailure = checkLegacySnapshot(
          expectedSnapshot.revision,
          expectedSnapshot.raw
        );
        if (snapshotFailure) return snapshotFailure;
      } else if (!isMigrationCurrent()) {
        return { status: "stale" };
      }

      return {
        status: "rejected",
        reason,
        cleanup: purgeLegacy(legacyKey),
      };
    };

    if (!isMigrationCurrent()) return { status: "stale" };
    if (!authenticatedOwner || !isStableOwner(authenticatedOwner)) {
      return rejectAndPurgeLegacy("unauthenticated");
    }
    if (
      authenticatedOwner !== currentOwner ||
      !isStableOwner(currentOwner)
    ) {
      return rejectAndPurgeLegacy("owner-mismatch");
    }

    const current = read(currentOwner);
    if (current.status === "found") {
      return finishLegacyCleanup(
        "target-wins",
        current.record,
        legacyKey,
        isMigrationCurrent
      );
    }
    if (current.status === "storage-error") return current;
    if (current.status === "clock-error") return current;
    if (current.status === "invalid-owner") {
      return rejectAndPurgeLegacy("owner-mismatch");
    }

    const legacy = driver.getItem(legacyKey);
    if (!legacy.ok) return { status: "storage-error", error: legacy.error };
    if (legacy.value === null) return { status: "missing" };

    const capturedLegacyRaw = legacy.value;
    const capturedRevision = operationRevision;
    let verification: LegacyMigrationVerification<T>;
    try {
      verification = await verifyAndMap(capturedLegacyRaw, {
        authenticatedOwner,
        currentOwner,
      });
    } catch {
      verification = { verified: false };
    }

    const snapshotAfterVerification = checkLegacySnapshot(
      capturedRevision,
      capturedLegacyRaw
    );
    if (snapshotAfterVerification) return snapshotAfterVerification;
    if (
      !verification.verified ||
      verification.subjectOwner !== currentOwner ||
      verification.serverTupleVerified !== true
    ) {
      return rejectAndPurgeLegacy("verification-failed", {
        revision: capturedRevision,
        raw: capturedLegacyRaw,
      });
    }
    if (
      !isRecord(verification.data) ||
      !hasExactKeys(verification.data, dataKeys) ||
      !validateData(verification.data)
    ) {
      return rejectAndPurgeLegacy("invalid-data", {
        revision: capturedRevision,
        raw: capturedLegacyRaw,
      });
    }

    const snapshotAfterValidation = checkLegacySnapshot(
      capturedRevision,
      capturedLegacyRaw
    );
    if (snapshotAfterValidation) return snapshotAfterValidation;

    const targetAfterVerification = driver.getItem(storageKey);
    if (!targetAfterVerification.ok) {
      return {
        status: "storage-error",
        error: targetAfterVerification.error,
      };
    }
    if (targetAfterVerification.value !== null) {
      const winningRecord = read(currentOwner);
      if (winningRecord.status === "found") {
        const snapshotBeforeTargetCleanup = checkLegacySnapshot(
          capturedRevision,
          capturedLegacyRaw
        );
        if (snapshotBeforeTargetCleanup) return snapshotBeforeTargetCleanup;

        return finishLegacyCleanup(
          "target-wins",
          winningRecord.record,
          legacyKey,
          isMigrationCurrent
        );
      }
      if (winningRecord.status === "storage-error") return winningRecord;
      if (winningRecord.status === "clock-error") return winningRecord;
      return { status: "stale" };
    }

    const snapshotBeforeWrite = checkLegacySnapshot(
      capturedRevision,
      capturedLegacyRaw
    );
    if (snapshotBeforeWrite) return snapshotBeforeWrite;
    const writeResult = write({
      owner: currentOwner,
      data: verification.data,
      isCurrent: () =>
        checkLegacySnapshot(capturedRevision, capturedLegacyRaw) === null,
    });
    if (writeResult.status !== "written") {
      return { status: "write-failed", result: writeResult };
    }

    const writtenRevision = operationRevision;
    const migrated = read(currentOwner);
    if (migrated.status !== "found") {
      return migrated.status === "storage-error" || migrated.status === "clock-error"
        ? migrated
        : { status: "stale" };
    }
    const snapshotBeforeLegacyCleanup = checkLegacySnapshot(
      writtenRevision,
      capturedLegacyRaw
    );
    if (snapshotBeforeLegacyCleanup) return snapshotBeforeLegacyCleanup;

    return finishLegacyCleanup(
      "migrated",
      migrated.record,
      legacyKey,
      isMigrationCurrent
    );
  };

  return {
    storageKey,
    read,
    write,
    clear,
    clearNamespace,
    invalidatePendingOperations: () => {
      operationRevision += 1;
    },
    migrateLegacy,
  };
};
