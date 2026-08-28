import { createSessionStorageDriver } from "./sessionStorageDriver";
import {
  createVersionedSessionStorage,
  LegacyMigrationVerification,
} from "./versionedSessionStorage";

interface CheckoutRecord {
  reservationUid: string;
  amount: number;
}

const ownerA = "subject:viewer_a";
const ownerB = "subject:viewer_b";
const legacyKey = "airbob:legacy-checkout";

const createStorage = (entries: Record<string, string> = {}): Storage => {
  const values = new Map(Object.entries(entries));

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

const isCheckoutRecord = (value: unknown): value is CheckoutRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.reservationUid === "string" &&
    typeof record.amount === "number" &&
    Number.isFinite(record.amount)
  );
};

const createRepository = ({
  storage = createStorage(),
  now = () => 1_000,
  getEpoch = () => 1,
}: {
  storage?: Storage;
  now?: () => number;
  getEpoch?: () => number;
} = {}) => ({
  storage,
  repository: createVersionedSessionStorage<CheckoutRecord>({
    namespace: "airbob:checkout-v1",
    slot: "handoff",
    purpose: "reservation-checkout",
    version: 1,
    privacyClass: "personal",
    containsPii: false,
    ttlMs: 5_000,
    dataKeys: ["reservationUid", "amount"],
    validateData: isCheckoutRecord,
    driver: createSessionStorageDriver({ getStorage: () => storage }),
    legacyKeys: [legacyKey],
    now,
    getEpoch,
  }),
});

const checkout: CheckoutRecord = {
  reservationUid: "reservation-verified",
  amount: 120_000,
};

describe("createVersionedSessionStorage", () => {
  it("writes an exact versioned, owned, expiring envelope under a static key", () => {
    const { storage, repository } = createRepository();

    expect(repository.write({ owner: ownerA, data: checkout })).toEqual({
      status: "written",
    });
    expect(repository.storageKey).toBe("airbob:checkout-v1:handoff");
    expect(repository.storageKey).not.toContain(checkout.reservationUid);
    expect(repository.storageKey).not.toContain(ownerA);
    expect(JSON.parse(storage.getItem(repository.storageKey) ?? "{}")).toEqual({
      purpose: "reservation-checkout",
      version: 1,
      privacyClass: "personal",
      containsPii: false,
      owner: ownerA,
      createdAt: 1_000,
      expiresAt: 6_000,
      data: checkout,
    });
    expect(repository.read(ownerA)).toEqual({
      status: "found",
      record: expect.objectContaining({ data: checkout, owner: ownerA }),
    });
  });

  it("refuses runtime identifiers as storage slots", () => {
    expect(() =>
      createVersionedSessionStorage<CheckoutRecord>({
        namespace: "airbob:checkout-v1",
        slot: "guest@example.com",
        purpose: "reservation-checkout",
        version: 1,
        privacyClass: "personal",
        containsPii: true,
        ttlMs: 100,
        dataKeys: ["reservationUid", "amount"],
        validateData: isCheckoutRecord,
      })
    ).toThrow("static slugs");
  });

  it.each([
    {
      name: "malformed JSON",
      raw: "{",
      reason: "malformed",
    },
    {
      name: "unknown envelope field",
      mutate: (record: Record<string, unknown>) => ({ ...record, extra: true }),
      reason: "unknown-fields",
    },
    {
      name: "wrong version",
      mutate: (record: Record<string, unknown>) => ({ ...record, version: 2 }),
      reason: "wrong-version",
    },
    {
      name: "foreign owner",
      mutate: (record: Record<string, unknown>) => ({ ...record, owner: ownerB }),
      reason: "foreign-owner",
    },
    {
      name: "unknown payload field",
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        data: { ...checkout, email: "must-not-survive@example.invalid" },
      }),
      reason: "unknown-fields",
    },
    {
      name: "wrong payload type",
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        data: { ...checkout, amount: "120000" },
      }),
      reason: "invalid-data",
    },
    {
      name: "extended lifetime",
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        expiresAt: 60_000,
      }),
      reason: "invalid-lifetime",
    },
    {
      name: "future creation time",
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        createdAt: 6_000,
        expiresAt: 11_000,
      }),
      reason: "invalid-lifetime",
    },
    {
      name: "expired record",
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        createdAt: 0,
        expiresAt: 5_000,
      }),
      reason: "expired",
    },
  ])("rejects and purges $name", ({ raw, mutate, reason }) => {
    const { storage, repository } = createRepository({ now: () => 5_000 });
    repository.write({ owner: ownerA, data: checkout });
    const valid = JSON.parse(storage.getItem(repository.storageKey) ?? "{}");
    storage.setItem(
      repository.storageKey,
      raw ?? JSON.stringify(mutate?.(valid) ?? valid)
    );

    expect(repository.read(ownerA)).toEqual({
      status: "rejected",
      reason,
      cleanup: "purged",
    });
    expect(storage.getItem(repository.storageKey)).toBeNull();
  });

  it("returns a typed failure without exposing storage values", () => {
    const storage = createStorage();
    jest.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("secret storage body");
    });
    const { repository } = createRepository({ storage });

    const result = repository.write({ owner: ownerA, data: checkout });

    expect(result).toEqual({
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "set" },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain(checkout.reservationUid);
  });

  it("clears only keys in its exact namespace", () => {
    const { storage, repository } = createRepository();
    storage.setItem(repository.storageKey, "record");
    storage.setItem("airbob:checkout-v1:index", "owned");
    storage.setItem("airbob:checkout-v10:handoff", "keep");
    storage.setItem("third-party", "keep");

    expect(repository.clearNamespace()).toEqual({ status: "cleared", removed: 2 });
    expect(storage.getItem(repository.storageKey)).toBeNull();
    expect(storage.getItem("airbob:checkout-v1:index")).toBeNull();
    expect(storage.getItem("airbob:checkout-v10:handoff")).toBe("keep");
    expect(storage.getItem("third-party")).toBe("keep");
  });

  it("migrates only after authenticated owner and server tuple verification", async () => {
    const storage = createStorage({ [legacyKey]: "legacy-document" });
    const order: string[] = [];
    const originalSetItem = storage.setItem.bind(storage);
    const originalRemoveItem = storage.removeItem.bind(storage);
    jest.spyOn(storage, "setItem").mockImplementation((key, value) => {
      order.push(`write:${key}`);
      originalSetItem(key, value);
    });
    jest.spyOn(storage, "removeItem").mockImplementation((key) => {
      order.push(`remove:${key}`);
      originalRemoveItem(key);
    });
    const { repository } = createRepository({ storage });
    const verifyAndMap = jest
      .fn<
        Promise<LegacyMigrationVerification<CheckoutRecord>>,
        [string, { authenticatedOwner: string; currentOwner: string }]
      >()
      .mockResolvedValue({
        verified: true,
        subjectOwner: ownerA,
        serverTupleVerified: true,
        data: checkout,
      });

    await expect(
      repository.migrateLegacy({
        legacyKey,
        authenticatedOwner: ownerA,
        currentOwner: ownerA,
        verifyAndMap,
        isCurrent: (expectedOwner) => expectedOwner === ownerA,
      })
    ).resolves.toEqual({
      status: "migrated",
      record: expect.objectContaining({ data: checkout, owner: ownerA }),
    });

    expect(verifyAndMap).toHaveBeenCalledWith("legacy-document", {
      authenticatedOwner: ownerA,
      currentOwner: ownerA,
    });
    expect(order).toEqual([
      `write:${repository.storageKey}`,
      `remove:${legacyKey}`,
    ]);
    expect(storage.getItem(legacyKey)).toBeNull();
  });

  it("requires epoch and current-owner guards for every legacy migration", async () => {
    expect(() =>
      createVersionedSessionStorage<CheckoutRecord>({
        namespace: "airbob:checkout-v1",
        slot: "handoff",
        purpose: "reservation-checkout",
        version: 1,
        privacyClass: "personal",
        containsPii: false,
        ttlMs: 5_000,
        dataKeys: ["reservationUid", "amount"],
        validateData: isCheckoutRecord,
        legacyKeys: [legacyKey],
      })
    ).toThrow("epoch provider");

    const storage = createStorage({ [legacyKey]: "legacy-document" });
    const { repository } = createRepository({ storage });
    const missingGuardOptions = {
      legacyKey,
      authenticatedOwner: ownerA,
      currentOwner: ownerA,
      verifyAndMap: async () => ({ verified: false } as const),
    } as unknown as Parameters<typeof repository.migrateLegacy>[0];

    await expect(
      repository.migrateLegacy(missingGuardOptions)
    ).rejects.toThrow("current authenticated owner guard");
    expect(storage.getItem(legacyKey)).toBe("legacy-document");
  });

  it.each([
    {
      name: "missing authentication",
      authenticatedOwner: null,
      currentOwner: ownerA,
      verification: {
        verified: true,
        subjectOwner: ownerA,
        serverTupleVerified: true,
        data: checkout,
      } as const,
      reason: "unauthenticated",
    },
    {
      name: "a different current subject",
      authenticatedOwner: ownerA,
      currentOwner: ownerB,
      verification: {
        verified: true,
        subjectOwner: ownerA,
        serverTupleVerified: true,
        data: checkout,
      } as const,
      reason: "owner-mismatch",
    },
    {
      name: "an unverified server tuple",
      authenticatedOwner: ownerA,
      currentOwner: ownerA,
      verification: { verified: false } as const,
      reason: "verification-failed",
    },
    {
      name: "a tuple for another subject",
      authenticatedOwner: ownerA,
      currentOwner: ownerA,
      verification: {
        verified: true,
        subjectOwner: ownerB,
        serverTupleVerified: true,
        data: checkout,
      } as const,
      reason: "verification-failed",
    },
  ])("purges legacy data rejected for $name", async (fixture) => {
    const storage = createStorage({ [legacyKey]: "legacy-document" });
    const { repository } = createRepository({ storage });

    await expect(
      repository.migrateLegacy({
        legacyKey,
        authenticatedOwner: fixture.authenticatedOwner,
        currentOwner: fixture.currentOwner,
        verifyAndMap: async () => fixture.verification,
        isCurrent: () => true,
      })
    ).resolves.toEqual({
      status: "rejected",
      reason: fixture.reason,
      cleanup: "purged",
    });
    expect(storage.getItem(legacyKey)).toBeNull();
    expect(storage.getItem(repository.storageKey)).toBeNull();
  });

  it("keeps the current target and never invokes a legacy verifier", async () => {
    const storage = createStorage({ [legacyKey]: "legacy-document" });
    const { repository } = createRepository({ storage });
    repository.write({ owner: ownerA, data: checkout });
    const verifyAndMap = jest.fn();

    await expect(
      repository.migrateLegacy({
        legacyKey,
        authenticatedOwner: ownerA,
        currentOwner: ownerA,
        verifyAndMap,
        isCurrent: (expectedOwner) => expectedOwner === ownerA,
      })
    ).resolves.toEqual({
      status: "target-wins",
      record: expect.objectContaining({ data: checkout }),
    });
    expect(verifyAndMap).not.toHaveBeenCalled();
    expect(storage.getItem(legacyKey)).toBeNull();
  });

  it("drops an async verification result after the active identity changes", async () => {
    let epoch = 1;
    let activeOwner: string | null = ownerA;
    let resolveVerification: (
      result: LegacyMigrationVerification<CheckoutRecord>
    ) => void = () => undefined;
    const verification = new Promise<LegacyMigrationVerification<CheckoutRecord>>(
      (resolve) => {
        resolveVerification = resolve;
      }
    );
    const storage = createStorage({ [legacyKey]: "legacy-document" });
    const { repository } = createRepository({
      storage,
      getEpoch: () => epoch,
    });

    const result = repository.migrateLegacy({
      legacyKey,
      authenticatedOwner: ownerA,
      currentOwner: ownerA,
      verifyAndMap: () => verification,
      isCurrent: (expectedOwner) => activeOwner === expectedOwner,
    });
    activeOwner = ownerB;
    epoch = 2;
    resolveVerification({
      verified: true,
      subjectOwner: ownerA,
      serverTupleVerified: true,
      data: checkout,
    });

    await expect(result).resolves.toEqual({ status: "stale" });
    expect(storage.getItem(repository.storageKey)).toBeNull();
    expect(storage.getItem(legacyKey)).toBe("legacy-document");
  });

  it("drops an async verification result after logout", async () => {
    let epoch = 1;
    let activeOwner: string | null = ownerA;
    let resolveVerification: (
      result: LegacyMigrationVerification<CheckoutRecord>
    ) => void = () => undefined;
    const verification = new Promise<LegacyMigrationVerification<CheckoutRecord>>(
      (resolve) => {
        resolveVerification = resolve;
      }
    );
    const storage = createStorage({ [legacyKey]: "legacy-document" });
    const { repository } = createRepository({
      storage,
      getEpoch: () => epoch,
    });

    const result = repository.migrateLegacy({
      legacyKey,
      authenticatedOwner: ownerA,
      currentOwner: ownerA,
      verifyAndMap: () => verification,
      isCurrent: (expectedOwner) => activeOwner === expectedOwner,
    });
    activeOwner = null;
    epoch = 2;
    resolveVerification({
      verified: true,
      subjectOwner: ownerA,
      serverTupleVerified: true,
      data: checkout,
    });

    await expect(result).resolves.toEqual({ status: "stale" });
    expect(storage.getItem(repository.storageKey)).toBeNull();
    expect(storage.getItem(legacyKey)).toBe("legacy-document");
  });

  it("does not revive a target after a concurrent verifier rejects and purges the legacy source", async () => {
    let resolveSlowVerification: (
      result: LegacyMigrationVerification<CheckoutRecord>
    ) => void = () => undefined;
    const slowVerification =
      new Promise<LegacyMigrationVerification<CheckoutRecord>>((resolve) => {
        resolveSlowVerification = resolve;
      });
    const storage = createStorage({ [legacyKey]: "legacy-document" });
    const { repository } = createRepository({ storage });

    const slowMigration = repository.migrateLegacy({
      legacyKey,
      authenticatedOwner: ownerA,
      currentOwner: ownerA,
      verifyAndMap: () => slowVerification,
      isCurrent: (expectedOwner) => expectedOwner === ownerA,
    });
    const rejectedMigration = repository.migrateLegacy({
      legacyKey,
      authenticatedOwner: ownerA,
      currentOwner: ownerA,
      verifyAndMap: async () => ({ verified: false }),
      isCurrent: (expectedOwner) => expectedOwner === ownerA,
    });

    await expect(rejectedMigration).resolves.toEqual({
      status: "rejected",
      reason: "verification-failed",
      cleanup: "purged",
    });
    expect(storage.getItem(legacyKey)).toBeNull();

    resolveSlowVerification({
      verified: true,
      subjectOwner: ownerA,
      serverTupleVerified: true,
      data: checkout,
    });

    await expect(slowMigration).resolves.toEqual({ status: "stale" });
    expect(storage.getItem(repository.storageKey)).toBeNull();
    expect(storage.getItem(legacyKey)).toBeNull();
  });

  it("drops a verified result when the legacy source is replaced in place", async () => {
    let resolveVerification: (
      result: LegacyMigrationVerification<CheckoutRecord>
    ) => void = () => undefined;
    const verification = new Promise<LegacyMigrationVerification<CheckoutRecord>>(
      (resolve) => {
        resolveVerification = resolve;
      }
    );
    const storage = createStorage({ [legacyKey]: "legacy-document" });
    const { repository } = createRepository({ storage });

    const result = repository.migrateLegacy({
      legacyKey,
      authenticatedOwner: ownerA,
      currentOwner: ownerA,
      verifyAndMap: () => verification,
      isCurrent: (expectedOwner) => expectedOwner === ownerA,
    });
    storage.setItem(legacyKey, "replacement-document");
    resolveVerification({
      verified: true,
      subjectOwner: ownerA,
      serverTupleVerified: true,
      data: checkout,
    });

    await expect(result).resolves.toEqual({ status: "stale" });
    expect(storage.getItem(repository.storageKey)).toBeNull();
    expect(storage.getItem(legacyKey)).toBe("replacement-document");
  });

  it("preserves legacy data when logout occurs before target-wins cleanup", async () => {
    let epoch = 1;
    let activeOwner: string | null = ownerA;
    const storage = createStorage({ [legacyKey]: "legacy-document" });
    const { repository } = createRepository({
      storage,
      getEpoch: () => epoch,
    });
    repository.write({ owner: ownerA, data: checkout });
    const originalGetItem = storage.getItem.bind(storage);
    jest.spyOn(storage, "getItem").mockImplementation((key) => {
      const value = originalGetItem(key);
      if (key === repository.storageKey) {
        activeOwner = null;
        epoch = 2;
      }
      return value;
    });
    const verifyAndMap = jest.fn();

    await expect(
      repository.migrateLegacy({
        legacyKey,
        authenticatedOwner: ownerA,
        currentOwner: ownerA,
        verifyAndMap,
        isCurrent: (expectedOwner) => activeOwner === expectedOwner,
      })
    ).resolves.toEqual({ status: "stale" });
    expect(verifyAndMap).not.toHaveBeenCalled();
    expect(storage.getItem(legacyKey)).toBe("legacy-document");
  });

  it("does not delete the legacy source when the new write fails", async () => {
    const storage = createStorage({ [legacyKey]: "legacy-document" });
    const originalSetItem = storage.setItem.bind(storage);
    jest.spyOn(storage, "setItem").mockImplementation((key, value) => {
      if (key === "airbob:checkout-v1:handoff") {
        throw new Error("quota denied");
      }
      originalSetItem(key, value);
    });
    const { repository } = createRepository({ storage });

    const result = await repository.migrateLegacy({
      legacyKey,
      authenticatedOwner: ownerA,
      currentOwner: ownerA,
      verifyAndMap: async () => ({
        verified: true,
        subjectOwner: ownerA,
        serverTupleVerified: true,
        data: checkout,
      }),
      isCurrent: (expectedOwner) => expectedOwner === ownerA,
    });

    expect(result).toEqual({
      status: "write-failed",
      result: {
        status: "storage-error",
        error: { kind: "storage-unavailable", operation: "set" },
      },
    });
    expect(storage.getItem(legacyKey)).toBe("legacy-document");
  });

  it("reports a distinct incomplete outcome when legacy cleanup is denied", async () => {
    const storage = createStorage({ [legacyKey]: "legacy-document" });
    const originalRemoveItem = storage.removeItem.bind(storage);
    jest.spyOn(storage, "removeItem").mockImplementation((key) => {
      if (key === legacyKey) throw new Error("cleanup denied");
      originalRemoveItem(key);
    });
    const { repository } = createRepository({ storage });

    await expect(
      repository.migrateLegacy({
        legacyKey,
        authenticatedOwner: ownerA,
        currentOwner: ownerA,
        verifyAndMap: async () => ({
          verified: true,
          subjectOwner: ownerA,
          serverTupleVerified: true,
          data: checkout,
        }),
        isCurrent: (expectedOwner) => expectedOwner === ownerA,
      })
    ).resolves.toEqual({
      status: "legacy-cleanup-failed",
      outcome: "migrated",
      record: expect.objectContaining({ data: checkout }),
      error: { kind: "storage-unavailable", operation: "remove" },
    });
    expect(storage.getItem(repository.storageKey)).not.toBeNull();
    expect(storage.getItem(legacyKey)).toBe("legacy-document");
  });

  it("fails closed for invalid privacy metadata and clocks", () => {
    expect(() =>
      createVersionedSessionStorage<CheckoutRecord>({
        namespace: "airbob:checkout-v1",
        slot: "handoff",
        purpose: "reservation-checkout",
        version: 1,
        privacyClass: "private" as "personal",
        containsPii: false,
        ttlMs: 5_000,
        dataKeys: ["reservationUid", "amount"],
        validateData: isCheckoutRecord,
      })
    ).toThrow("privacy class");

    const { repository } = createRepository({
      now: () => Number.MAX_SAFE_INTEGER,
    });
    expect(repository.write({ owner: ownerA, data: checkout })).toEqual({
      status: "invalid-clock",
    });
  });
});
